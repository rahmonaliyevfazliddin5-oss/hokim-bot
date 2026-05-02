import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AdminCtx {
  isAdmin: boolean;
  login: (u: string, p: string) => boolean;
  logout: () => void;
}

const Ctx = createContext<AdminCtx | null>(null);

const KEY = "hokim_admin_session";
// NOTE: MVP-level gate. For production use real auth.
const ADMIN_USER = "admin";
const ADMIN_PASS = "fazliddin123";

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem(KEY) === "1");
  }, []);

  const login = (u: string, p: string) => {
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      sessionStorage.setItem(KEY, "1");
      setIsAdmin(true);
      return true;
    }
    return false;
  };
  const logout = () => {
    sessionStorage.removeItem(KEY);
    setIsAdmin(false);
  };

  return <Ctx.Provider value={{ isAdmin, login, logout }}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used inside AdminProvider");
  return c;
}
