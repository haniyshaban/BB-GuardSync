// Black Belt - GuardSync Shared Utilities

/**
 * Merge Tailwind CSS class names
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Format time to HH:MM
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toTimeString().slice(0, 5);
}

/**
 * Format datetime for display
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate hours between two dates
 */
export function hoursBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
}

/**
 * Calculate distance between two GPS coordinates (Haversine formula)
 * Returns distance in meters
 */
export function distanceMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random face check times for a shift
 * Returns array of ISO timestamps for scheduled face checks
 */
export function generateFaceCheckTimes(
  shiftStart: string,
  shiftEnd: string,
  count: number = 0 // 0 means random 2-4
): string[] {
  const checksCount = count || randomInt(2, 4);
  const start = new Date(shiftStart).getTime();
  const end = new Date(shiftEnd).getTime();
  const duration = end - start;
  
  // Divide shift into equal segments, place check randomly in each
  const segmentDuration = duration / checksCount;
  const times: string[] = [];
  
  for (let i = 0; i < checksCount; i++) {
    const segStart = start + i * segmentDuration;
    const segEnd = segStart + segmentDuration;
    // Random time within segment, with 15-min buffer from edges
    const buffer = Math.min(15 * 60 * 1000, segmentDuration * 0.2);
    const t = segStart + buffer + Math.random() * (segEnd - segStart - 2 * buffer);
    times.push(new Date(t).toISOString());
  }
  
  return times.sort();
}

/**
 * Determine guard status from activity data
 */
export function computeGuardStatus(
  clockedIn: boolean,
  lastLocationTime: string | null,
  previousLat: number | null,
  previousLng: number | null,
  currentLat: number | null,
  currentLng: number | null,
  idleThresholdMins: number = 35,
  idleDistanceMeters: number = 50
): 'online' | 'offline' | 'idle' {
  if (!clockedIn) return 'offline';
  
  if (!lastLocationTime) return 'online'; // just clocked in, no location yet
  
  const minutesSinceUpdate = (Date.now() - new Date(lastLocationTime).getTime()) / (1000 * 60);
  
  // No location update for too long = idle
  if (minutesSinceUpdate > idleThresholdMins) return 'idle';
  
  // Check if guard has moved
  if (previousLat != null && previousLng != null && currentLat != null && currentLng != null) {
    const distance = distanceMeters(previousLat, previousLng, currentLat, currentLng);
    if (distance < idleDistanceMeters) return 'idle';
  }
  
  return 'online';
}

/**
 * Export attendance data to CSV format
 */
export function attendanceToCSV(records: any[]): string {
  if (records.length === 0) return '';
  
  const headers = ['Date', 'Guard Name', 'Site', 'Clock In', 'Clock Out', 'Hours Worked'];
  const rows = records.map(r => [
    r.date,
    r.guardName || r.guard_name || '',
    r.siteName || r.site_name || '',
    r.clockIn || r.clock_in || '',
    r.clockOut || r.clock_out || '',
    r.hoursWorked || r.hours_worked || '',
  ]);
  
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}
