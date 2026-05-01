"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
            <Button variant="ghost" size="icon-sm" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-[var(--color-industrial-yellow)] text-[10px] font-bold text-[var(--color-industrial-blue)]">
                3
              </span>
            </Button>
            <Badge
              variant="outline"
              className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:inline-flex"
            >
              Verified Account
            </Badge>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </Link>
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
