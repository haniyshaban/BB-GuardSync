import { createContext, useContext, useState, ReactNode } from 'react';
import { guardApi } from '@/services/api';

interface GuardUser {
  id: number;
  name: string;
  phone: string;
  email: string;
  site_id?: number;
  siteName?: string;
  shift_id?: number;
  shiftLabel?: string;
  clocked_in: boolean;
  clock_in_time?: string;
  daily_rate: number;
  employee_id?: string;
  approval_status: string;
  hasFaceDescriptor?: boolean;
}

interface AuthContextType {
  user: GuardUser | null;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<GuardUser>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GuardUser | null>(() => {
    const stored = localStorage.getItem('bb_guard_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (identifier: string, password: string) => {
    const res = await guardApi.login(identifier, password);
    localStorage.setItem('bb_guard_token', res.data.token);
    localStorage.setItem('bb_guard_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('bb_guard_token');
    localStorage.removeItem('bb_guard_user');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await guardApi.getProfile();
      localStorage.setItem('bb_guard_user', JSON.stringify(res.data));
      setUser(res.data);
    } catch {
      // If token expired, logout
      logout();
    }
  };

  const updateUser = (updates: Partial<GuardUser>) => {
    if (user) {
      const updated = { ...user, ...updates };
      localStorage.setItem('bb_guard_user', JSON.stringify(updated));
      setUser(updated);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
