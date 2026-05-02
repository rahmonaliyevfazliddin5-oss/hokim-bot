import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";

export function AppLayout() {
  const { t } = useI18n();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full gradient-soft">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between border-b border-border/60 bg-card/60 backdrop-blur-md px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
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
            {t("footer")}
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
