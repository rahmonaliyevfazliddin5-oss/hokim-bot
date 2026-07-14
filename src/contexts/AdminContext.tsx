import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { adminLogin, getAdminToken, getAdminRole, getAdminUsername, clearAdmin, type AdminRole, canRole } from "@/lib/adminApi";

interface AdminCtx {
  isAdmin: boolean;
  role: AdminRole | null;
  username: string | null;
  login: (u: string, p: string) => Promise<boolean>;
  logout: () => void;
  can: (cap: Parameters<typeof canRole>[1]) => boolean;
}

const Ctx = createContext<AdminCtx | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    setIsAdmin(!!getAdminToken());
    setRole(getAdminRole());
    setUsername(getAdminUsername());
  }, []);

  const login = async (u: string, p: string) => {
    const r = await adminLogin(u, p);
    setIsAdmin(r.ok);
    setRole(r.ok ? (r.role ?? "superadmin") : null);
    setUsername(r.ok ? u : null);
    return r.ok;
  };
  const logout = () => {
    clearAdmin();
    setIsAdmin(false); setRole(null); setUsername(null);
  };
  const can = (cap: Parameters<typeof canRole>[1]) => canRole(role, cap);

  return <Ctx.Provider value={{ isAdmin, role, username, login, logout, can }}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used inside AdminProvider");
  return c;
}
