"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  Building2,
  Clock3,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/logs", label: "Logs", icon: Clock3 },
  { href: "/reports", label: "Reports", icon: Activity },
  { href: "/sync", label: "Sync", icon: RefreshCw },
  { href: "/audit", label: "Audit", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-panel flex h-full w-[248px] flex-col rounded-2xl border border-border/70 bg-white/88 p-3">
      <div className="mb-3 px-2 pb-3 pt-2">
        <p className="text-xl font-semibold tracking-tight">Houra</p>
        <p className="mt-1 text-xs text-muted-foreground">Student-only service tracking</p>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/85 hover:bg-secondary",
              )}
            >
              <Icon className="size-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg border border-border/70 bg-surface/70 p-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">Student session</p>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </aside>
  );
}
