import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { adminLogin, getAdminToken, setAdminToken } from "@/lib/adminApi";

interface AdminCtx {
  isAdmin: boolean;
  login: (u: string, p: string) => Promise<boolean>;
  logout: () => void;
}

const Ctx = createContext<AdminCtx | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(!!getAdminToken());
  }, []);

  const login = async (u: string, p: string) => {
    const ok = await adminLogin(u, p);
    setIsAdmin(ok);
    return ok;
  };
  const logout = () => {
    setAdminToken(null);
    setIsAdmin(false);
  };

  return <Ctx.Provider value={{ isAdmin, login, logout }}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used inside AdminProvider");
  return c;
}
