const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api';

function getToken(): string | null {
  return localStorage.getItem('bb_guard_token');
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (res.status === 401) {
    localStorage.removeItem('bb_guard_token');
    localStorage.removeItem('bb_guard_user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const text = await res.text();
  if (!text) throw new Error('Empty response from server');

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Server returned an invalid response. Check that VITE_API_URL is set correctly.');
  }

  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const guardApi = {
  // Auth
  login: (identifier: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),

  getProfile: () => request('/auth/me'),

  // Enrollment
  enroll: (data: { name: string; phone: string; email: string; password: string; orgCode: string; faceDescriptor?: string }) =>
    request('/guards/enroll', { method: 'POST', body: JSON.stringify(data) }),

  // Validate org code
  validateOrgCode: (code: string) =>
    request(`/org/validate/${encodeURIComponent(code)}`),

  // Attendance
  clockIn: (lat?: number, lng?: number) =>
    request('/attendance/clock-in', { method: 'POST', body: JSON.stringify({ lat, lng }) }),

  clockOut: (lat?: number, lng?: number) =>
    request('/attendance/clock-out', { method: 'POST', body: JSON.stringify({ lat, lng }) }),

  getAttendance: (page = 1) => request(`/attendance?page=${page}&limit=20`),

  // Location
  submitLocation: (lat: number, lng: number, accuracy?: number) =>
    request('/locations', { method: 'POST', body: JSON.stringify({ lat, lng, accuracy }) }),

  // Face checks
  getPendingFaceChecks: (guardId: number) => request(`/face-checks/pending/${guardId}`),

  submitFaceCheckResult: (checkId: number, passed: boolean, faceDescriptor?: string) =>
    request(`/face-checks/${checkId}/result`, { method: 'POST', body: JSON.stringify({ passed, faceDescriptor }) }),

  // Payroll
  getPayroll: () => request('/payroll'),

  // Config
  getConfig: () => request('/config'),
};
