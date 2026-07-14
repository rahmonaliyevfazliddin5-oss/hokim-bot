import { NavLink, useLocation } from "react-router-dom";
import { Home, FilePlus, Search, LayoutDashboard, BarChart3, Users, ScrollText, LogOut, MessageSquare, KeyRound, ShieldCheck, Timer } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar
} from "@/components/ui/sidebar";
import { useI18n } from "@/i18n/I18nProvider";
import { useAdmin } from "@/contexts/AdminContext";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/hokim-logo.png.asset.json";

export function AppSidebar() {
  const { t } = useI18n();
  const { isAdmin, logout } = useAdmin();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const userItems = [
    { url: "/", icon: Home, label: t("nav.home") },
    { url: "/chat", icon: MessageSquare, label: t("nav.chat") },
    { url: "/submit", icon: FilePlus, label: t("nav.submit") },
    { url: "/track", icon: Search, label: t("nav.track") },
  ];

  const adminItems = [
    { url: "/admin/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { url: "/admin/stats", icon: BarChart3, label: t("nav.stats") },
    { url: "/admin/users", icon: Users, label: t("nav.users") },
    { url: "/admin/logs", icon: ScrollText, label: t("nav.logs") },
    { url: "/admin/mahalla-passwords", icon: KeyRound, label: "Mahalla parollari" },
    { url: "/admin/mahalla-security", icon: ShieldCheck, label: "Mahalla xavfsizlik" },
  ];

  const linkCls = (active: boolean) => cn("flex items-center gap-3 w-full", active && "font-semibold");

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="h-10 w-10 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center shadow-elegant shrink-0 overflow-hidden">
            <img src={logoAsset.url} alt="Farg'ona hokimligi" className="h-9 w-9 object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-sidebar-foreground leading-tight">{t("brand")}</div>
              <div className="text-[10px] text-sidebar-foreground/60 leading-tight truncate">Farg'ona tumani hokimligi</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Menyu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {userItems.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <NavLink to={item.url} end className={({ isActive }) => linkCls(isActive)}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>{t("nav.admin")}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map(item => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <NavLink to={item.url} className={({ isActive }) => linkCls(isActive)}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {isAdmin && (
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenuButton onClick={logout} className="text-sidebar-foreground/80 hover:text-sidebar-foreground">
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>{t("nav.logout")}</span>}
          </SidebarMenuButton>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
