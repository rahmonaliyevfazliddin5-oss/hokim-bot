import { NavLink, useLocation } from "react-router-dom";
import { Home, FilePlus, Search, LayoutDashboard, BarChart3, Users, ScrollText, Shield, LogOut, LogIn } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar
} from "@/components/ui/sidebar";
import { useI18n } from "@/i18n/I18nProvider";
import { useAdmin } from "@/contexts/AdminContext";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { t } = useI18n();
  const { isAdmin, logout } = useAdmin();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const userItems = [
    { url: "/", icon: Home, label: t("nav.home") },
    { url: "/submit", icon: FilePlus, label: t("nav.submit") },
    { url: "/track", icon: Search, label: t("nav.track") },
  ];

  const adminItems = [
    { url: "/admin/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { url: "/admin/stats", icon: BarChart3, label: t("nav.stats") },
    { url: "/admin/users", icon: Users, label: t("nav.users") },
    { url: "/admin/logs", icon: ScrollText, label: t("nav.logs") },
  ];

  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 w-full",
      active && "font-semibold"
    );

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="h-9 w-9 rounded-lg gradient-accent flex items-center justify-center shadow-elegant shrink-0">
            <Shield className="h-5 w-5 text-accent-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-sidebar-foreground leading-tight">{t("brand")}</div>
              <div className="text-[10px] text-sidebar-foreground/60 leading-tight truncate">Hokimlik tizimi</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>{t("nav.home")}</SidebarGroupLabel>}
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

      <SidebarFooter className="border-t border-sidebar-border">
        {isAdmin ? (
          <SidebarMenuButton onClick={logout} className="text-sidebar-foreground/80 hover:text-sidebar-foreground">
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>{t("nav.logout")}</span>}
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton asChild>
            <NavLink to="/admin/login" className="flex items-center gap-3">
              <LogIn className="h-4 w-4" />
              {!collapsed && <span>{t("nav.login")}</span>}
            </NavLink>
          </SidebarMenuButton>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
