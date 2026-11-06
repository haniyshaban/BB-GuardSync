// Operational monitoring job: AI Sleep Alert, low-battery, offline, and overtime detection.
// Rule-based "AI": during the configured night-shift window, a clocked-in guard with no
// location movement and no completed face check within `sleep_inactivity_mins` is flagged.
const db = require('../db');
const { createAlert } = require('../lib/alerts');

// Is "HH:MM" now within a possibly-overnight [start, end) window?
function isWithinWindow(start, end, now = new Date()) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s === e) return true;
  return s < e ? (cur >= s && cur < e) : (cur >= s || cur < e); // overnight wrap
}

function runMonitoring() {
  try {
    // Keep the customer-demo guards "live" (fresh GPS pings) between boots.
    if (process.env.SEED_DEMO_HRBR) {
      try { require('../seed-demo-hrbr').refreshPings(); } catch (e) { /* non-fatal */ }
    }

    const cfg = db.prepare('SELECT * FROM system_config WHERE id = 1').get() || {};
    const inactivityMins = cfg.sleep_inactivity_mins || 45;
    const lowBattery = cfg.low_battery_threshold || 15;
    const offlineMins = (cfg.location_update_interval_mins || 30) * 2;
    const offsiteGraceMins = cfg.offsite_grace_mins || 10;
    const nightStart = cfg.night_shift_start || '22:00';
    const nightEnd = cfg.night_shift_end || '06:00';
    const isNight = isWithinWindow(nightStart, nightEnd);

    const guards = db.prepare(`
      SELECT g.id, g.name, g.org_id, g.site_id, g.offsite_since,
             s.lat AS site_lat, s.lng AS site_lng, s.geofence_radius_m, s.geofence_enabled, s.name AS site_name
      FROM guards g LEFT JOIN sites s ON s.id = g.site_id
      WHERE g.clocked_in = 1 AND g.approval_status = 'active'
    `).all();

    let sleepAlerts = 0, batteryAlerts = 0, offlineAlerts = 0, offsiteAlerts = 0;

    for (const g of guards) {
      const lastLoc = db.prepare(
        'SELECT lat, lng, battery, timestamp FROM guard_locations WHERE guard_id = ? ORDER BY timestamp DESC LIMIT 1'
      ).get(g.id);

      // --- Low battery ---
      if (lastLoc && lastLoc.battery != null && lastLoc.battery <= lowBattery) {
        if (createAlert({
          orgId: g.org_id, guardId: g.id, siteId: g.site_id, type: 'low_battery', severity: 'low',
          message: `${g.name}'s device battery is ${lastLoc.battery}%`,
          meta: { battery: lastLoc.battery },
        })) batteryAlerts++;
      }

      // --- Offline (no ping in 2x interval) ---
      const minsSincePing = lastLoc
        ? (Date.now() - new Date(lastLoc.timestamp + 'Z').getTime()) / 60000
        : Infinity;
      if (minsSincePing > offlineMins) {
        if (createAlert({
          orgId: g.org_id, guardId: g.id, siteId: g.site_id, type: 'offline', severity: 'medium',
          message: `${g.name} has not reported location in over ${Math.round(offlineMins)} min`,
          meta: { lastPing: lastLoc?.timestamp || null },
        })) offlineAlerts++;
      }

      // --- Geofence breach (off-site) ---
      if (g.geofence_enabled && g.site_lat != null && lastLoc && lastLoc.lat != null) {
        const dist = haversine(lastLoc.lat, lastLoc.lng, g.site_lat, g.site_lng);
        const radius = g.geofence_radius_m || 150;
        if (dist > radius) {
          // Outside the fence: start the clock if not already running.
          if (!g.offsite_since) {
            db.prepare("UPDATE guards SET offsite_since = datetime('now') WHERE id = ?").run(g.id);
          } else {
            const outMins = (Date.now() - new Date(g.offsite_since + 'Z').getTime()) / 60000;
            if (outMins >= offsiteGraceMins) {
              if (createAlert({
                orgId: g.org_id, guardId: g.id, siteId: g.site_id, type: 'offsite', severity: 'high',
                message: `${g.name} is off-site — ${Math.round(dist)} m from ${g.site_name || 'post'} for ${Math.round(outMins)} min`,
                meta: { distance: Math.round(dist), radius, offsiteSince: g.offsite_since },
              })) offsiteAlerts++;
            }
          }
        } else if (g.offsite_since) {
          // Back inside the fence: clear the breach timer.
          db.prepare('UPDATE guards SET offsite_since = NULL WHERE id = ?').run(g.id);
        }
      }

      // --- AI Sleep Alert (night shift inactivity) ---
      if (isNight) {
        // Movement check: compare two most recent pings within the inactivity window.
        const recent = db.prepare(
          "SELECT lat, lng, timestamp FROM guard_locations WHERE guard_id = ? AND timestamp >= datetime('now', ?) ORDER BY timestamp DESC"
        ).all(g.id, `-${inactivityMins} minutes`);

        // Completed (passed/failed) face check within window = guard is awake/responsive.
        const recentFace = db.prepare(
          "SELECT id FROM face_checks WHERE guard_id = ? AND completed_at IS NOT NULL AND completed_at >= datetime('now', ?) LIMIT 1"
        ).get(g.id, `-${inactivityMins} minutes`);

        let moved = false;
        if (recent.length >= 2) {
          const a = recent[0], b = recent[recent.length - 1];
          const dist = haversine(a.lat, a.lng, b.lat, b.lng);
          if (dist > (cfg.idle_distance_meters || 50)) moved = true;
        }

        // Flag only if: we have data, no movement, and no responsive face check.
        const hasData = recent.length >= 1 || !!lastLoc;
        if (hasData && !moved && !recentFace && minsSincePing <= offlineMins) {
          if (createAlert({
            orgId: g.org_id, guardId: g.id, siteId: g.site_id, type: 'sleep', severity: 'high',
            message: `Possible inactivity (sleep) detected for ${g.name} on night shift — no movement or response in ${inactivityMins} min`,
            meta: { inactivityMins },
          })) sleepAlerts++;
        }
      }
    }

    const total = sleepAlerts + batteryAlerts + offlineAlerts + offsiteAlerts;
    if (total > 0) {
      console.log(`[Monitoring] alerts created — sleep:${sleepAlerts} battery:${batteryAlerts} offline:${offlineAlerts} offsite:${offsiteAlerts}`);
    }
    return { sleepAlerts, batteryAlerts, offlineAlerts, offsiteAlerts };
  } catch (err) {
    console.error('[Monitoring] Error:', err.message);
    return null;
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v == null)) return 0;
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { runMonitoring, isWithinWindow };
