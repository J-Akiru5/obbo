'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
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
  Lock,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Notification } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { ClientKycProvider, useClientKyc, type KycStatus } from '@/lib/context/client-kyc-context';

const navItems = [
  { href: '/client/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/client/catalog', label: 'Product Catalog', icon: PackageSearch },
  {
    href: '/client/orders',
    label: 'My Orders',
    icon: ClipboardList,
    lockHref: '/client/orders/new',
  },
  { href: '/client/ledger', label: 'Balance Ledger', icon: WalletCards, locked: true },
  { href: '/client/profile', label: 'Profile & Settings', icon: CircleUserRound },
  { href: '/client/contact-admin', label: 'Contact Admin', icon: Contact },
];

function KycStatusBox({ kycStatus }: { kycStatus: KycStatus }) {
  if (kycStatus === 'verified') {
    return (
      <div className="bg-sidebar-accent/55 rounded-lg p-3">
        <div className="text-sidebar-accent-foreground mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-semibold tracking-wide uppercase">KYC Verified</span>
        </div>
        <p className="text-sidebar-foreground/70 text-xs">
          You can now place orders and request re-delivery anytime.
        </p>
      </div>
    );
  }

  if (kycStatus === 'rejected') {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
        <div className="mb-2 flex items-center gap-2 text-red-500 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs font-semibold tracking-wide uppercase">KYC Rejected</span>
        </div>
        <p className="text-sidebar-foreground/70 text-xs">
          Your verification was rejected. Please contact admin for assistance.
        </p>
      </div>
    );
  }

  // pending_verification (default)
  return (
    <div className="bg-status-pending-bg/20 border-status-pending-border/30 rounded-lg border p-3">
      <div className="text-status-pending-text mb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 animate-pulse" />
        <span className="text-xs font-semibold tracking-wide uppercase">Under Review</span>
      </div>
      <p className="text-sidebar-foreground/70 text-xs">
        Your account is pending KYC approval. Some features are limited.
      </p>
    </div>
  );
}

import { RealTimeClock } from '@/components/real-time-clock';

function SidebarContent({
  pathname,
  onNavigate,
  onSignOut,
}: {
  pathname: string;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  const { kycStatus } = useClientKyc();
  const isUnverified = kycStatus !== 'verified';

  return (
    <div className="flex h-full flex-col">
      <div className="border-sidebar-border flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-9 w-9 items-center justify-center">
          <Image
            src="/logo.png"
            alt="OBBO Logo"
            width={36}
            height={36}
            className="object-contain"
          />
        </div>
        <div>
          <p className="text-sidebar-foreground text-base font-bold tracking-tight">OBBO iManage</p>
          <p className="text-sidebar-foreground/65 text-xs">Client Portal</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const showLock = isUnverified && item.locked;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {showLock && (
                <Lock className="text-status-pending-text h-3 w-3 shrink-0 opacity-90" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-4 px-4 py-4">
        <RealTimeClock />
        <div className="border-sidebar-border border-t pt-4">
          <KycStatusBox kycStatus={kycStatus} />
        </div>
        <div className="border-sidebar-border border-t pt-2 lg:hidden">
          <button
            type="button"
            onClick={onSignOut}
            className="text-sidebar-foreground hover:bg-sidebar-accent/50 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import { GlobalSearch } from '@/components/global-search';
import { ThemeToggle } from '@/components/theme-toggle';

function ClientLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };
  const { kycStatus } = useClientKyc();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('CL');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile to get avatar
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, full_name')
        .eq('id', user.id)
        .single();

      if (profile) {
        setAvatarUrl(profile.avatar_url);
        if (profile.full_name) {
          setInitials(
            profile.full_name
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2),
          );
        }
      }

      // Fetch last 20 notifications
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch TOTAL unread count
      const { count: unread } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(notifs ?? []);
      setUnreadCount(unread ?? 0);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    window.addEventListener('profile-updated', loadNotifications);

    let channel: any;
    const supabase = createClient();

    const setupSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`client-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadNotifications();
          },
        )
        .subscribe();
    };

    setupSubscription();
    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener('profile-updated', loadNotifications);
    };
  }, [loadNotifications]);

  const markAllRead = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      toast.error('Failed to mark notifications as read.');
    }
  };

  // Derive header badge content from kycStatus
  const kycBadge =
    kycStatus === 'verified'
      ? {
          label: 'Verified Account',
          className: 'border-status-success-border bg-status-success-bg text-status-success-text',
        }
      : kycStatus === 'rejected'
        ? {
            label: 'KYC Rejected',
            className:
              'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400',
          }
        : {
            label: 'Pending KYC',
            className: 'border-status-pending-border bg-status-pending-bg text-status-pending-text',
          };

  return (
    <div className="bg-muted/30 min-h-screen lg:flex">
      <aside className="border-sidebar-border bg-sidebar fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r lg:flex">
        <SidebarContent pathname={pathname} onSignOut={handleSignOut} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:ml-72">
        <header className="border-border bg-background/95 sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b px-3 backdrop-blur-sm sm:gap-4 sm:px-4 lg:px-6">
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                className="hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-md lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </SheetTrigger>
              <SheetContent side="left" className="bg-sidebar w-72 p-0">
                <SidebarContent
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                  onSignOut={handleSignOut}
                />
              </SheetContent>
            </Sheet>

            <Link href="/client/dashboard" className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="OBBO Logo"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <span className="text-primary text-sm font-bold">OBBO</span>
            </Link>

            <div className="hidden sm:block">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Client Portal</p>
              <h1 className="text-foreground text-sm font-semibold">
                {navItems.find((item) => pathname.startsWith(item.href))?.label ?? 'Dashboard'}
              </h1>
            </div>
          </div>

          <div className="flex flex-1 justify-end lg:justify-center">
            <GlobalSearch />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Popover
              open={notifOpen}
              onOpenChange={(open) => {
                setNotifOpen(open);
                if (open && unreadCount > 0) markAllRead();
              }}
            >
              <PopoverTrigger
                className="hover:bg-muted relative inline-flex h-8 w-8 items-center justify-center rounded-md"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="bg-accent text-accent-foreground absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b p-3">
                  <PopoverTitle className="text-sm font-semibold">Notifications</PopoverTitle>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-primary text-xs hover:underline">
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-muted-foreground p-6 text-center text-sm">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n: any) => (
                      <Link
                        key={n.id}
                        href={n.href || '/client/orders'}
                        onClick={() => setNotifOpen(false)}
                      >
                        <div
                          className={`border-border hover:bg-muted/50 border-b px-3 py-2.5 transition-colors ${!n.is_read ? 'bg-status-info-bg/30' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            {n.severity === 'warning' ? (
                              <AlertCircle className="text-status-pending-text mt-0.5 h-3.5 w-3.5 shrink-0" />
                            ) : n.severity === 'success' ? (
                              <CheckCircle2 className="text-status-success-text mt-0.5 h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <Info className="text-status-info-text mt-0.5 h-3.5 w-3.5 shrink-0" />
                            )}
                            <div>
                              <p
                                className={`text-xs font-medium ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}
                              >
                                {n.title}
                              </p>
                              <p className="text-muted-foreground mt-0.5 text-[10px]">
                                {n.message}
                              </p>
                              <p className="text-muted-foreground/80 mt-1 text-[9px]">
                                {new Date(n.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                <div className="border-t p-2">
                  <Link href="/client/dashboard" onClick={() => setNotifOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full text-xs">
                      View all on Dashboard
                    </Button>
                  </Link>
                </div>
              </PopoverContent>
            </Popover>

            {/* Dynamic KYC badge */}
            <Badge variant="outline" className={`hidden sm:inline-flex ${kycBadge.className}`}>
              {kycBadge.label}
            </Badge>

            <Link href="/client/profile">
              <Avatar className="ring-primary h-8 w-8 cursor-pointer transition-all hover:ring-2">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
            </Link>

            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = '/login';
              }}
              className="text-muted-foreground hover:bg-muted hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:inline-flex"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </header>

        <a
          href="#main-content"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:outline-none"
        >
          Skip to content
        </a>
        <main id="main-content" className="relative flex-1 p-4 sm:p-6">
          <div className="from-primary/5 pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent" />
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientKycProvider>
      <ClientLayoutInner>{children}</ClientLayoutInner>
    </ClientKycProvider>
  );
}
