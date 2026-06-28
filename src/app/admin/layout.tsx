'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  ShoppingCart,
  Warehouse,
  Users,
  Menu,
  LogOut,
  Bell,
  ChevronDown,
  Package,
  AlertCircle,
  CheckCircle2,
  Info,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import type { Notification } from '@/lib/types/database';
import { ThemeToggle } from '@/components/theme-toggle';
import { GlobalSearch } from '@/components/global-search';
import { BottomNavbar } from '@/components/bottom-navbar';

const ADMIN_NAV_ITEMS = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/admin/products',
    label: 'Products',
    icon: Package,
  },
  {
    href: '/admin/clients',
    label: 'Clients',
    icon: Users,
    subItems: [
      { href: '/admin/clients?tab=directory', label: 'Directory' },
      { href: '/admin/clients?tab=kyc', label: 'KYC Approvals' },
    ],
  },
  {
    href: '/admin/reports',
    label: 'Reports',
    icon: Warehouse,
  },
];

const WAREHOUSE_NAV_ITEMS = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    icon: ShoppingCart,
    subItems: [
      { href: '/admin/orders?tab=new', label: 'New Requests' },
      { href: '/admin/orders?tab=fulfillment', label: 'Fulfillment' },
      { href: '/admin/orders?tab=tracking', label: 'Tracking' },
      { href: '/admin/orders?tab=history', label: 'History' },
    ],
  },
  {
    href: '/admin/products',
    label: 'Products',
    icon: Package,
  },
  {
    href: '/admin/inventory',
    label: 'Inventory',
    icon: Warehouse,
    subItems: [
      { href: '/admin/inventory?tab=shipments', label: 'Shipments' },
      { href: '/admin/inventory?tab=po', label: 'P.O. List' },
      { href: '/admin/inventory?tab=dr', label: 'D.R. List' },
    ],
  },
  {
    href: '/admin/reports/warehouse-manager',
    label: 'Reports',
    icon: FileText,
  },
  {
    href: '/admin/clients',
    label: 'Clients',
    icon: Users,
    subItems: [
      { href: '/admin/clients?tab=directory', label: 'Directory' },
      { href: '/admin/clients?tab=kyc', label: 'KYC Approvals' },
    ],
  },
];

import { RealTimeClock } from '@/components/real-time-clock';

function SidebarContent({
  pathname,
  navItems,
  onNavigate,
  adminName,
  adminInitials,
  avatarUrl,
  pendingOrderCount,
  pendingKycCount,
}: {
  pathname: string;
  navItems: typeof ADMIN_NAV_ITEMS;
  onNavigate?: () => void;
  adminName?: string;
  adminInitials?: string;
  avatarUrl?: string | null;
  pendingOrderCount?: number;
  pendingKycCount?: number;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (pathname.startsWith(item.href)) {
        initial[item.href] = true;
      }
    });
    return initial;
  });

  const toggleExpand = (href: string) => {
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="border-sidebar-border flex h-16 items-center gap-2.5 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center">
          <Image
            src="/logo.png"
            alt="OBBO Logo"
            width={32}
            height={32}
            className="object-contain"
          />
        </div>
        <span className="text-sidebar-foreground text-lg font-bold tracking-tight">
          OBBO <span className="font-light opacity-70">iManage</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const isExpanded = expanded[item.href];
          return (
            <div key={item.href} className="space-y-1">
              {!item.subItems ? (
                // Direct link — no dropdown (e.g. Dashboard)
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  }`}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              ) : (
                // Expandable dropdown
                <>
                  <button
                    onClick={() => toggleExpand(item.href)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.label === 'Orders' && (pendingOrderCount ?? 0) > 0 && (
                        <Badge className="bg-accent text-accent-foreground hover:bg-accent/90 px-1.5 py-0 text-xs">
                          {pendingOrderCount}
                        </Badge>
                      )}
                      {item.label === 'Clients' && (pendingKycCount ?? 0) > 0 && (
                        <Badge className="bg-red-500 px-1.5 py-0 text-xs text-white hover:bg-red-500">
                          {pendingKycCount}
                        </Badge>
                      )}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="space-y-1 py-1 pr-3 pl-11">
                      {item.subItems.map((subItem, idx) => (
                        <Link
                          key={`${subItem.href}-${idx}`}
                          href={subItem.href}
                          onClick={onNavigate}
                          className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 block rounded-md px-3 py-2 text-sm transition-colors"
                        >
                          {subItem.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 px-4 py-4">
        <RealTimeClock />

        <div className="border-sidebar-border border-t pt-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="border-border h-8 w-8 border">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
              ) : (
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold">
                  {adminInitials ?? 'AD'}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sidebar-foreground truncate text-sm font-medium">
                {adminName ?? 'Administrator'}
              </p>
              <p className="text-sidebar-foreground/50 truncate text-xs">Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminName, setAdminName] = useState('Administrator');
  const [adminInitials, setAdminInitials] = useState('AD');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState<'admin' | 'warehouse_manager' | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [pendingKycCount, setPendingKycCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch last 20 notifications — by user_id only
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch TOTAL unread count — by user_id only
      const { count: unread } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(notifs ?? []);
      setUnreadCount(unread ?? 0);
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
  }, []);
  const navItems =
    adminRole === 'admin'
      ? ADMIN_NAV_ITEMS
      : adminRole === 'warehouse_manager'
        ? WAREHOUSE_NAV_ITEMS
        : [];

  const fetchProfile = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role, avatar_url')
        .eq('id', user.id)
        .single();

      const name = profile?.full_name || user.email?.split('@')[0] || 'Admin';
      setAdminName(name);
      if (profile?.role === 'admin' || profile?.role === 'warehouse_manager') {
        setAdminRole(profile.role);
      } else {
        setAdminRole(null);
      }
      setAvatarUrl(profile?.avatar_url || null);
      setAdminInitials(
        name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
      );
    } else {
      setAdminRole(null);
    }
  }, []);

  const fetchPendingCounts = useCallback(async () => {
    try {
      const supabase = createClient();
      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'awaiting_check', 'pending_final_confirmation']);
      const { count: kycCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('kyc_status', 'pending_verification')
        .eq('role', 'client');
      setPendingOrderCount(orderCount ?? 0);
      setPendingKycCount(kycCount ?? 0);
    } catch (e) {
      console.error('Error fetching pending counts:', e);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    loadNotifications();
    fetchPendingCounts();

    window.addEventListener('profile-updated', fetchProfile);
    return () => {
      window.removeEventListener('profile-updated', fetchProfile);
    };
  }, [loadNotifications, fetchProfile, fetchPendingCounts]);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`admin-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          loadNotifications();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          fetchPendingCounts();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchPendingCounts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications, fetchPendingCounts]);

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

  const markRead = async (id: string) => {
    try {
      const supabase = createClient();
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      loadNotifications(); // Refresh count properly
    } catch {
      console.error('Failed to mark notification as read');
    }
  };

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success('Signed out.');
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="bg-background flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="bg-sidebar border-sidebar-border fixed inset-y-0 left-0 z-40 hidden flex-col border-r lg:flex lg:w-64">
        <SidebarContent
          pathname={pathname}
          navItems={navItems}
          adminName={adminName}
          adminInitials={adminInitials}
          avatarUrl={avatarUrl}
          pendingOrderCount={pendingOrderCount}
          pendingKycCount={pendingKycCount}
        />
      </aside>

      {/* Main Content */}
      <div className="flex min-h-screen flex-1 flex-col lg:ml-64">
        {/* Top Bar */}
        <header className="bg-card border-border sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 lg:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                className="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </SheetTrigger>
              <SheetContent side="left" className="bg-sidebar w-64 p-0">
                <SidebarContent
                  pathname={pathname}
                  navItems={navItems}
                  onNavigate={() => setMobileOpen(false)}
                  adminName={adminName}
                  adminInitials={adminInitials}
                  avatarUrl={avatarUrl}
                  pendingOrderCount={pendingOrderCount}
                  pendingKycCount={pendingKycCount}
                />
              </SheetContent>
            </Sheet>

            <div className="hidden sm:block">
              <h1 className="text-foreground text-lg font-semibold whitespace-nowrap">
                {navItems.find((i) => pathname.startsWith(i.href))?.label || 'Admin'}
              </h1>
            </div>
          </div>

          <div className="flex flex-1 justify-center px-2 sm:px-4">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Popover
              open={notifOpen}
              onOpenChange={(open) => {
                setNotifOpen(open);
                if (open && unreadCount > 0) markAllRead();
              }}
            >
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    {unreadCount > 0 && (
                      <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                }
              />
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
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.href || '/admin/dashboard'}
                        onClick={() => {
                          setNotifOpen(false);
                          if (!n.is_read) markRead(n.id);
                        }}
                      >
                        <div
                          className={`border-border hover:bg-accent border-b px-3 py-2.5 transition-colors ${!n.is_read ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            {n.severity === 'warning' ? (
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                            ) : n.severity === 'success' ? (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            ) : (
                              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
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
                              <p className="text-muted-foreground/60 mt-1 text-[9px]">
                                {new Date(n.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
                <div className="border-t p-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground w-full text-xs"
                    onClick={() => setNotifOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger className="hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-2 rounded-md px-2 transition-colors">
                <Avatar className="h-8 w-8">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                      {adminInitials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="hidden text-sm font-medium sm:block">
                  {adminName.split(' ')[0]}
                </span>
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => router.push('/admin/profile')}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <a
          href="#main-content"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:outline-none"
        >
          Skip to content
        </a>
        <main id="main-content" className="flex-1 p-4 pb-20 lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNavbar />
    </div>
  );
}
