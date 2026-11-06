// Geofence helpers shared by clock-in, the monitoring job and the live dashboard.
// A site fence is either a circle (centre + radius) or a polygon (ordered points).
const db = require('../db');

function haversine(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(v => v == null)) return null;
  const R = 6371e3;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Ray casting: is the point inside the polygon? Fine at site scale (no projection needed).
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].lat, xi = polygon[i].lng;
    const yj = polygon[j].lat, xj = polygon[j].lng;
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonPoints(siteId) {
  return db.prepare('SELECT lat, lng FROM site_geofence_points WHERE site_id = ? ORDER BY point_order').all(siteId);
}

// Load polygon points for many sites in one query: { [siteId]: [{lat,lng}, ...] }.
function polygonsBySite() {
  const rows = db.prepare('SELECT site_id, lat, lng FROM site_geofence_points ORDER BY site_id, point_order').all();
  const out = {};
  for (const r of rows) (out[r.site_id] = out[r.site_id] || []).push({ lat: r.lat, lng: r.lng });
  return out;
}

// Is a fence configured and usable for this site?
function fenceActive(site, polygon) {
  if (!site || !site.geofence_enabled) return false;
  if (site.geofence_type === 'polygon') return Array.isArray(polygon) && polygon.length >= 3;
  return site.lat != null && site.lng != null;
}

/**
 * Check a position against a site's fence.
 * site needs: lat, lng, geofence_enabled, geofence_type, geofence_radius_m.
 * Returns { active, inside, distance } where distance is metres from the site centre
 * (or polygon centroid when the site has no centre), for display.
 */
function checkFence(site, lat, lng, polygon) {
  if (lat == null || lng == null) return { active: false, inside: true, distance: null };
  const poly = site && site.geofence_type === 'polygon' ? (polygon || polygonPoints(site.id)) : null;
  if (!fenceActive(site, poly)) return { active: false, inside: true, distance: null };

  let cLat = site.lat, cLng = site.lng;
  if ((cLat == null || cLng == null) && poly) {
    cLat = poly.reduce((s, p) => s + p.lat, 0) / poly.length;
    cLng = poly.reduce((s, p) => s + p.lng, 0) / poly.length;
  }
  const distance = haversine(lat, lng, cLat, cLng);
  const inside = poly ? pointInPolygon(lat, lng, poly) : distance <= (site.geofence_radius_m || 150);
  return { active: true, inside, distance: distance == null ? null : Math.round(distance) };
}

module.exports = { haversine, pointInPolygon, polygonPoints, polygonsBySite, fenceActive, checkFence };
