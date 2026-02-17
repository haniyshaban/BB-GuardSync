// Black Belt - GuardSync Shared Types

// ============ ENUMS ============

export type GuardStatus = 'online' | 'offline' | 'idle';
export type GuardApprovalStatus = 'pending' | 'active' | 'inactive' | 'rejected';
export type PayrollStatus = 'draft' | 'approved' | 'paid';
export type ShiftDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type StaffRole = 'admin' | 'staff';
export type FaceCheckStatus = 'pending' | 'passed' | 'failed' | 'expired';

// ============ GUARD ============

export interface Guard {
  id: number;
  name: string;
  phone: string;
  email: string;
  password?: string; // never sent to client
  employeeId?: string;
  siteId?: number;
  siteName?: string;
  shiftId?: number;
  shiftLabel?: string;
  approvalStatus: GuardApprovalStatus;
  status: GuardStatus; // computed: online/offline/idle
  clockedIn: boolean;
  clockInTime?: string;
  dailyRate: number;
  faceDescriptor?: string; // JSON array of face embedding
  photoUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GuardEnrollment {
  name: string;
  phone: string;
  email: string;
  password: string;
  photoUrl?: string;
  faceDescriptor?: string;
}

export interface GuardAuthorization {
  siteId: number;
  shiftId: number;
  dailyRate: number;
  employeeId?: string;
}

// ============ SITE ============

export interface Site {
  id: number;
  name: string;
  address: string;
  contactPerson?: string;
  contactPhone?: string;
  guardCount?: number;
  shifts?: SiteShift[];
  createdAt: string;
}

export interface SiteShift {
  id: number;
  siteId: number;
  label: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  daysOfWeek: ShiftDay[];
}

// ============ ATTENDANCE ============

export interface AttendanceRecord {
  id: number;
  guardId: number;
  guardName?: string;
  siteId: number;
  siteName?: string;
  clockIn: string;
  clockOut?: string;
  date: string;
  hoursWorked?: number;
}

export interface ClockInRequest {
  guardId: number;
  siteId: number;
  lat?: number;
  lng?: number;
}

export interface ClockOutRequest {
  guardId: number;
  lat?: number;
  lng?: number;
}

// ============ LOCATION ============

export interface GuardLocation {
  id: number;
  guardId: number;
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: string;
}

export interface LocationSubmission {
  guardId: number;
  lat: number;
  lng: number;
  accuracy?: number;
}

// ============ FACE CHECK ============

export interface FaceCheck {
  id: number;
  guardId: number;
  scheduledFor: string;
  requestedAt: string;
  completedAt?: string;
  status: FaceCheckStatus;
  passed?: boolean;
}

export interface FaceCheckResult {
  checkId: number;
  passed: boolean;
  faceDescriptor?: string;
}

// ============ PAYROLL ============

export interface PayrollRecord {
  id: number;
  guardId: number;
  guardName?: string;
  month: number;
  year: number;
  totalDaysWorked: number;
  dailyRate: number;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: PayrollStatus;
  generatedAt: string;
}

export interface PayrollGenerate {
  month: number;
  year: number;
  guardIds?: number[]; // if empty, generate for all active guards
}

// ============ STAFF ============

export interface Staff {
  id: number;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role: StaffRole;
  createdAt: string;
}

// ============ DASHBOARD STATS ============

export interface DashboardStats {
  totalGuards: number;
  activeGuards: number;
  onlineGuards: number;
  offlineGuards: number;
  idleGuards: number;
  totalSites: number;
  todayAttendance: number;
  pendingEnrollments: number;
  pendingFaceChecks: number;
}

// ============ API RESPONSES ============

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

export interface AuthResponse {
  token: string;
  user: Guard | Staff;
  role: 'guard' | 'admin' | 'staff';
}

// ============ SYSTEM CONFIG ============

export interface SystemConfig {
  locationUpdateIntervalMins: number; // default 30
  faceChecksPerDay: number;           // default 2-4 (random)
  dataRetentionDays: number;          // default 30
  idleThresholdMins: number;          // default 35
  idleDistanceMeters: number;         // default 50
}
