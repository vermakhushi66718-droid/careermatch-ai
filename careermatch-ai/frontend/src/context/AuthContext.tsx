import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { api, refreshSession, setAccessToken, setAuthLostHandler } from "../lib/api";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (fullName: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
  reload: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthLostHandler(() => { setAccessToken(null); setUser(null); });
    (async () => {
      try {
        if (await refreshSession()) setUser((await api.get<{ user: User }>("/auth/me")).user);
      } finally { setLoading(false); }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ user: User; accessToken: string }>("/auth/login", { email, password });
    setAccessToken(r.accessToken); setUser(r.user); return r.user;
  }, []);
  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const r = await api.post<{ user: User; accessToken: string }>("/auth/register", { fullName, email, password });
    setAccessToken(r.accessToken); setUser(r.user); return r.user;
  }, []);
  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    setAccessToken(null); setUser(null);
  }, []);
  const reload = useCallback(async () => { setUser((await api.get<{ user: User }>("/auth/me")).user); }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, setUser, reload }), [user, loading, login, register, logout, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error("AuthProvider missing"); return c; };
