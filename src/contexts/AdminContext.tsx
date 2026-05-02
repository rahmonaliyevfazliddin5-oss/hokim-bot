import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AdminCtx {
  isAdmin: boolean;
  login: (u: string, p: string) => boolean;
  logout: () => void;
}

const Ctx = createContext<AdminCtx | null>(null);

const KEY = "hokim_admin";

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(localStorage.getItem(KEY) === "1");
  }, []);

  const login = (u: string, p: string) => {
    if (u === "admin" && p === "admin123") {
      localStorage.setItem(KEY, "1");
      setIsAdmin(true);
      return true;
    }
    return false;
  };
  const logout = () => {
    localStorage.removeItem(KEY);
    setIsAdmin(false);
  };

  return <Ctx.Provider value={{ isAdmin, login, logout }}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used inside AdminProvider");
  return c;
}
