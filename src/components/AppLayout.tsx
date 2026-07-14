import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";

const SECRET = "hokim";

export function AppLayout() {
  const { t } = useI18n();
  const nav = useNavigate();
  const buf = useRef("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      buf.current = (buf.current + e.key.toLowerCase()).slice(-SECRET.length);
      if (buf.current === SECRET) { buf.current = ""; nav("/admin/login"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav]);

  // Triple-click on year in footer also opens admin login (mobile escape hatch)
  const clicks = useRef<number[]>([]);
  const onYearClick = () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter(t => now - t < 1500), now];
    if (clicks.current.length >= 5) { clicks.current = []; nav("/admin/login"); }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full gradient-soft">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between border-b border-border/60 bg-card/60 backdrop-blur-md px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger aria-label="Menyuni ochish/yopish" />
              <div className="hidden sm:block">
                <div className="text-sm font-semibold">{t("brand")}</div>
                <div className="text-xs text-muted-foreground">{t("tagline")}</div>
              </div>
            </div>
            <LanguageSwitcher />
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
          <footer className="border-t border-border/60 px-6 py-4 text-xs text-muted-foreground text-center">
            <span onClick={onYearClick} className="cursor-default select-none">{t("footer")}</span>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
