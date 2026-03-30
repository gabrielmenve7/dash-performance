"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Users,
  LayoutDashboard,
  Settings,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  userRole: string;
  userName: string;
}

const adminLinks = [
  { href: "/assistant", label: "Assistente", icon: MessageSquare },
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/reports", label: "Relatórios", icon: FileText },
  { href: "/settings", label: "Configurações", icon: Settings },
];

const clientLinks = [
  { href: "/", label: "Meu Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Relatórios", icon: FileText },
];

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const links = userRole === "CLIENT" ? clientLinks : adminLinks;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-screen bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex items-center gap-3 p-4 h-16">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h2 className="text-sm font-bold truncate">Dash Performance</h2>
              <p className="text-xs text-sidebar-muted-foreground truncate">Ads Analytics</p>
            </div>
          )}
        </div>

        <Separator className="bg-sidebar-border" />

        <nav className="flex-1 p-2 space-y-1">
          {links.map((link) => {
            const isActive = pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            const linkContent = (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <link.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={link.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{link.label}</TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        <Separator className="bg-sidebar-border" />

        <div className="p-2">
          {!collapsed && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-sidebar-muted-foreground capitalize">
                {userRole.toLowerCase()}
              </p>
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {!collapsed && <span>Sair</span>}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Sair</TooltipContent>}
          </Tooltip>
        </div>

        <div className="p-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full h-8 text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
