import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import uz from "./locales/uz.json";
import uz_cyrl from "./locales/uz_cyrl.json";
import ru from "./locales/ru.json";

export type Lang = "uz" | "uz_cyrl" | "ru";

const dicts: Record<Lang, any> = { uz, uz_cyrl, ru };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

function detectInitial(): Lang {
  const saved = localStorage.getItem("hokim_lang") as Lang | null;
  if (saved && dicts[saved]) return saved;
  const nav = navigator.language?.toLowerCase() || "";
  if (nav.startsWith("ru")) return "ru";
  return "uz";
}

function resolve(obj: any, path: string): string {
  return path.split(".").reduce((acc, k) => (acc != null ? acc[k] : undefined), obj) ?? path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitial());

  useEffect(() => {
    localStorage.setItem("hokim_lang", lang);
    document.documentElement.lang = lang === "ru" ? "ru" : "uz";
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);
  const t = (key: string) => resolve(dicts[lang], key);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
