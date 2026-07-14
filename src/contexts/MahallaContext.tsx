import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getMahallaToken, getMahallaName, setMahallaSession, mahallaLogin } from "@/lib/mahallaApi";

interface MahallaCtx {
  mahalla: string | null;
  login: (m: string, p: string) => Promise<boolean>;
  logout: () => void;
}

const Ctx = createContext<MahallaCtx | null>(null);

export function MahallaProvider({ children }: { children: ReactNode }) {
  const [mahalla, setMahalla] = useState<string | null>(null);

  useEffect(() => {
    if (getMahallaToken()) setMahalla(getMahallaName());
  }, []);

  const login = async (m: string, p: string) => {
    const ok = await mahallaLogin(m, p);
    if (ok) setMahalla(m);
    return ok;
  };
  const logout = () => {
    setMahallaSession(null, null);
    setMahalla(null);
  };

  return <Ctx.Provider value={{ mahalla, login, logout }}>{children}</Ctx.Provider>;
}

export function useMahalla() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMahalla must be used inside MahallaProvider");
  return c;
}
