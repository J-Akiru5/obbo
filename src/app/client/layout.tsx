"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  CircleUserRound,
  ClipboardList,
  Contact,
  Gauge,
  LogOut,
  Menu,
  PackageSearch,
  ShieldCheck,
  WalletCards,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const navItems = [
  { href: "/client/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/client/catalog", label: "Product Catalog", icon: PackageSearch },
  { href: "/client/orders", label: "My Orders", icon: ClipboardList },
  { href: "/client/ledger", label: "Balance Ledger", icon: WalletCards },
  { href: "/client/profile", label: "Profile & Settings", icon: CircleUserRound },
  { href: "/client/contact-admin", label: "Contact Admin", icon: Contact },
];

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center">
          <Image src="/logo.jpg" alt="OBBO Logo" width={36} height={36} className="object-contain" />
        </div>
        <div>
          <p className="text-base font-bold tracking-tight text-sidebar-foreground">OBBO iManage</p>
          <p className="text-xs text-sidebar-foreground/65">Client Portal</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="rounded-lg bg-sidebar-accent/55 p-3">
          <div className="mb-2 flex items-center gap-2 text-sidebar-accent-foreground">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">KYC Verified</span>
          </div>
          <p className="text-xs text-sidebar-foreground/70">
            You can now place orders and request re-delivery anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, count } = await supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      setNotifications(data ?? []);
      const unread = data?.filter((n: any) => !n.is_read).length ?? 0;
      setUnreadCount(unread);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    // Subscribe to real-time notifications
    const supabase = createClient();
    const channel = supabase
      .channel("client-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        loadNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadNotifications]);

  const markAllRead = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      toast.error("Failed to mark notifications as read.");
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 lg:flex">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarContent pathname={pathname} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:ml-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur-sm lg:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted lg:hidden">
                <Menu className="h-4 w-4" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0">
                <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <Link href="/client/dashboard" className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center">
                <Image src="/logo.jpg" alt="OBBO Logo" width={32} height={32} className="object-contain" />
              </div>
              <span className="text-sm font-bold text-[var(--color-industrial-blue)]">OBBO</span>
            </Link>

            <div className="hidden sm:block">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Client Portal</p>
              <h1 className="text-sm font-semibold text-foreground">
                {navItems.find((item) => pathname.startsWith(item.href))?.label ?? "Dashboard"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger render={<button type="button" className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" />}>
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-[var(--color-industrial-yellow)] text-[10px] font-bold text-[var(--color-industrial-blue)] flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between p-3 border-b">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-[var(--color-industrial-blue)] hover:underline">
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-500">No notifications yet</div>
                  ) : (
                    notifications.map((n: any) => (
                      <Link key={n.id} href={n.href || "/client/orders"} onClick={() => setNotifOpen(false)}>
                        <div className={`px-3 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}>
                          <div className="flex items-start gap-2">
                            {n.severity === 'warning' ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                            ) : n.severity === 'success' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            ) : (
                              <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                            )}
                            <div>
                              <p className={`text-xs font-medium ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">{n.message}</p>
                              <p className="text-[9px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                <div className="p-2 border-t">
                  <Link href="/client/dashboard" onClick={() => setNotifOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full text-xs">View all on Dashboard</Button>
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
            <Badge
              variant="outline"
              className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:inline-flex"
            >
              Verified Account
            </Badge>
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </header>

        <main className="relative flex-1 p-4 sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--color-industrial-blue)]/5 to-transparent" />
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}
