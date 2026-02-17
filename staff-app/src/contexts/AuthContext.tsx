import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/utils';

interface Staff {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthCtx {
  staff: Staff | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('bb_staff_token');
    if (!token) { setLoading(false); return; }
    api('/staff/me').then((r: any) => setStaff(r.data)).catch(() => localStorage.removeItem('bb_staff_token')).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res: any = await api('/staff/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('bb_staff_token', res.token);
    setStaff(res.data);
  };

  const logout = () => {
    localStorage.removeItem('bb_staff_token');
    setStaff(null);
  };

  return <Ctx.Provider value={{ staff, loading, login, logout }}>{children}</Ctx.Provider>;
}
