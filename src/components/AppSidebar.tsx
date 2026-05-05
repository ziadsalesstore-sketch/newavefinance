import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, Package, TrendingUp, Receipt, BarChart3, FileText, Settings as SettingsIcon, LogOut, Boxes, Wallet } from "lucide-react";
import logo from "@/assets/logo.jpg";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Products", url: "/products", icon: Boxes },
  { title: "Stock", url: "/stock", icon: Package },
  { title: "Revenue", url: "/revenue", icon: TrendingUp },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Sales", url: "/sales", icon: BarChart3 },
  { title: "Withdrawals", url: "/withdrawals", icon: Wallet },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-lg grid place-items-center bg-white overflow-hidden">
            <img src={logo} alt="Newave Finance logo" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-bold text-sidebar-foreground">Newave Finance</div>
              <div className="text-[10px] text-sidebar-foreground/60 truncate max-w-[140px]">{user?.email}</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenuButton onClick={() => signOut()}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign out</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
