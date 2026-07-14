import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getMahallaToken, getMahallaName, mahallaLogin, mahallaLogout } from "@/lib/mahallaApi";

export interface LoginResult {
  ok: boolean;
  error?: string;
  retryAfter?: number;
}

interface MahallaCtx {
  mahalla: string | null;
  login: (m: string, p: string) => Promise<LoginResult>;
  logout: () => void;
}

const Ctx = createContext<MahallaCtx | null>(null);

export function MahallaProvider({ children }: { children: ReactNode }) {
  const [mahalla, setMahalla] = useState<string | null>(null);

  useEffect(() => {
    if (getMahallaToken()) setMahalla(getMahallaName());
  }, []);

  const login = async (m: string, p: string): Promise<LoginResult> => {
    const res = await mahallaLogin(m, p);
    if (res.ok) setMahalla(m);
    return res;
  };
  const logout = () => {
    mahallaLogout();
    setMahalla(null);
  };

  return <Ctx.Provider value={{ mahalla, login, logout }}>{children}</Ctx.Provider>;
}

export function useMahalla() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMahalla must be used inside MahallaProvider");
  return c;
}
