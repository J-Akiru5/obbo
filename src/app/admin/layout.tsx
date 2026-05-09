"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
    LayoutDashboard,
    ShoppingCart,
    Warehouse,
    Users,
    Menu,
    X,
    LogOut,
    Bell,
    ChevronDown,
    Package,
    AlertCircle,
    CheckCircle2,
    Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Notification } from "@/lib/types/database";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";

const ADMIN_NAV_ITEMS = [
    { 
        href: "/admin/dashboard", 
        label: "Dashboard", 
        icon: LayoutDashboard,
    },
    {
        href: "/admin/products",
        label: "Products",
        icon: Package,
    },
    { 
        href: "/admin/clients", 
        label: "Clients", 
        icon: Users,
        subItems: [
            { href: "/admin/clients?tab=directory", label: "Directory" },
            { href: "/admin/clients?tab=kyc", label: "KYC Approvals" }
        ]
    },
    {
        href: "/admin/reports",
        label: "Reports",
        icon: Warehouse,
    },
];

const WAREHOUSE_NAV_ITEMS = [
    { 
        href: "/admin/dashboard", 
        label: "Dashboard", 
        icon: LayoutDashboard,
    },
    { 
        href: "/admin/orders", 
        label: "Orders", 
        icon: ShoppingCart,
        subItems: [
            { href: "/admin/orders?tab=new", label: "New Requests" },
            { href: "/admin/orders?tab=fulfillment", label: "Fulfillment" },
            { href: "/admin/orders?tab=tracking", label: "Tracking" }
        ]
    },
    {
        href: "/admin/products",
        label: "Products",
        icon: Package,
    },
    { 
        href: "/admin/inventory", 
        label: "Inventory", 
        icon: Warehouse,
        subItems: [
            { href: "/admin/inventory?tab=shipments", label: "Shipments" },
            { href: "/admin/inventory?tab=po", label: "P.O. List" },
            { href: "/admin/inventory?tab=dr", label: "D.R. List" },
            { href: "/admin/inventory?tab=reports", label: "Reports" }
        ]
    },
];

function SidebarContent({ pathname, navItems, onNavigate, adminName, adminInitials }: { pathname: string; navItems: typeof ADMIN_NAV_ITEMS; onNavigate?: () => void; adminName?: string; adminInitials?: string }) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        navItems.forEach(item => {
            if (pathname.startsWith(item.href)) {
                initial[item.href] = true;
            }
        });
        return initial;
    });

    const toggleExpand = (href: string) => {
        setExpanded(prev => ({ ...prev, [href]: !prev[href] }));
    };

    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
                <div className="w-8 h-8 flex items-center justify-center">
                    <Image src="/logo.png" alt="OBBO Logo" width={32} height={32} className="object-contain" />
                </div>
                <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
                    OBBO <span className="font-light opacity-70">iManage</span>
                </span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                        }`}
                                >
                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                    <span>{item.label}</span>
                                </Link>
                            ) : (
                                // Expandable dropdown
                                <>
                                    <button
                                        onClick={() => toggleExpand(item.href)}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className="w-5 h-5 flex-shrink-0" />
                                            <span>{item.label}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.label === "Orders" && (
                                                <Badge className="bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] text-xs px-1.5 py-0 hover:bg-[var(--color-industrial-yellow)]">
                                                    2
                                                </Badge>
                                            )}
                                            {item.label === "Clients" && (
                                                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0 hover:bg-red-500">
                                                    2
                                                </Badge>
                                            )}
                                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="pl-11 pr-3 py-1 space-y-1">
                                            {item.subItems.map((subItem, idx) => (
                                                <Link
                                                    key={`${subItem.href}-${idx}`}
                                                    href={subItem.href}
                                                    onClick={onNavigate}
                                                    className="block px-3 py-2 rounded-md text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
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

            {/* User info */}
            <div className="px-3 py-4 border-t border-sidebar-border">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                        <span className="text-xs font-bold text-sidebar-accent-foreground">{adminInitials ?? "AD"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-sidebar-foreground truncate">{adminName ?? "Administrator"}</p>
                        <p className="text-xs text-sidebar-foreground/50 truncate">Administrator</p>
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
    const [adminName, setAdminName] = useState("Administrator");
    const [adminInitials, setAdminInitials] = useState("AD");
    const [adminRole, setAdminRole] = useState<"admin" | "warehouse_manager" | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [notifOpen, setNotifOpen] = useState(false);

    const loadNotifications = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch last 20 notifications
            const { data: notifs } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(20);
            
            // Fetch TOTAL unread count
            const { count: unread } = await supabase
                .from("notifications")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id)
                .eq("is_read", false);

            setNotifications(notifs ?? []);
            setUnreadCount(unread ?? 0);
        } catch (e) {
            console.error("Error loading notifications:", e);
        }
    }, []);
    const navItems = adminRole === "admin"
        ? ADMIN_NAV_ITEMS
        : adminRole === "warehouse_manager"
            ? WAREHOUSE_NAV_ITEMS
            : [];

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                supabase
                    .from("profiles")
                    .select("full_name, role")
                    .eq("id", data.user.id)
                    .single()
                    .then(({ data: profile }) => {
                        const name = profile?.full_name || data.user?.email?.split("@")[0] || "Admin";
                        setAdminName(name);
                        if (profile?.role === "admin" || profile?.role === "warehouse_manager") {
                            setAdminRole(profile.role);
                        } else {
                            setAdminRole(null);
                        }
                        setAdminInitials(
                            name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                        );
                    });
            } else {
                setAdminRole(null);
            }
        });

        loadNotifications();

        let channel: any;
        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            channel = supabase
                .channel(`admin-notifications-${user.id}`)
                .on(
                    "postgres_changes", 
                    { 
                        event: "*", 
                        schema: "public", 
                        table: "notifications",
                        filter: `user_id=eq.${user.id}`
                    }, 
                    () => {
                        loadNotifications();
                    }
                )
                .subscribe();
        };

        setupSubscription();
        return () => { if (channel) supabase.removeChannel(channel); };
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

    async function handleSignOut() {
        const supabase = createClient();
        await supabase.auth.signOut();
        toast.success("Signed out.");
        router.push("/login");
        router.refresh();
    }

    return (
        <div className="min-h-screen flex bg-background">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex lg:w-64 flex-col bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 z-40">
                <SidebarContent pathname={pathname} navItems={navItems} adminName={adminName} adminInitials={adminInitials} />
            </aside>

            {/* Main Content */}
            <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
                {/* Top Bar */}
                <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        {/* Mobile menu */}
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger
                                className="inline-flex items-center justify-center rounded-md w-9 h-9 hover:bg-accent hover:text-accent-foreground transition-colors lg:hidden"
                            >
                                <Menu className="w-5 h-5" />
                            </SheetTrigger>
                            <SheetContent side="left" className="w-64 p-0 bg-sidebar">
                                <SidebarContent pathname={pathname} navItems={navItems} onNavigate={() => setMobileOpen(false)} />
                            </SheetContent>
                        </Sheet>

                        <div className="hidden sm:block">
                            <h1 className="text-lg font-semibold text-foreground whitespace-nowrap">
                                {navItems.find((i) => pathname.startsWith(i.href))?.label || "Admin"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex-1 max-w-xl px-4 flex justify-center">
                        <GlobalSearch />
                    </div>

                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Popover open={notifOpen} onOpenChange={(open) => { setNotifOpen(open); if (open && unreadCount > 0) markAllRead(); }}>
                            <PopoverTrigger 
                                render={
                                    <Button variant="ghost" size="icon" className="relative">
                                        <Bell className="w-5 h-5" />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--color-industrial-red)] text-white text-[10px] font-bold flex items-center justify-center">
                                                {unreadCount > 9 ? "9+" : unreadCount}
                                            </span>
                                        )}
                                    </Button>
                                }
                            />
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
                                        notifications.map((n) => (
                                            <Link key={n.id} href={n.href || "/admin/dashboard"} onClick={() => setNotifOpen(false)}>
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
                                <div className="p-2 border-t text-center">
                                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setNotifOpen(false)}>
                                        Close
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <DropdownMenu>
                            <DropdownMenuTrigger
                                className="inline-flex items-center gap-2 px-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                                <Avatar className="w-8 h-8">
                                    <AvatarFallback className="bg-[var(--color-industrial-blue)] text-white text-xs font-bold">{adminInitials}</AvatarFallback>
                                </Avatar>
                                <span className="hidden sm:block text-sm font-medium">{adminName.split(" ")[0]}</span>
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => router.push("/admin/profile")}>Profile</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push("/admin/settings")}>Settings</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
