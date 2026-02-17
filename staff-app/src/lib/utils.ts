import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BASE = '/api';

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('bb_staff_token');
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function statusColor(s: string) {
  if (s === 'online') return 'bg-green-500';
  if (s === 'idle') return 'bg-yellow-500';
  return 'bg-gray-400';
}

export function statusBadge(s: string) {
  if (s === 'online') return 'bg-green-100 text-green-800';
  if (s === 'idle') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}
