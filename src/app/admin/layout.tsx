"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
    LayoutDashboard,
    Users,
    Menu,
    LogOut,
    Bell,
    ChevronDown,
    FileText,
    Settings,
    ShoppingCart,
    Warehouse,
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

type NavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    subItems?: Array<{ href: string; label: string }>;
};

const adminNavItems: NavItem[] = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/clients", label: "Clients", icon: Users },
    { href: "/admin/reports", label: "Reports", icon: FileText },
    { href: "/admin/settings", label: "Settings", icon: Settings },
];

const warehouseNavItems: NavItem[] = [
    {
        href: "/admin/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        subItems: [{ href: "/admin/dashboard", label: "Overview" }],
    },
    {
        href: "/admin/orders",
        label: "Orders",
        icon: ShoppingCart,
        subItems: [
            { href: "/admin/orders?tab=new", label: "New Requests" },
            { href: "/admin/orders?tab=fulfillment", label: "Fulfillment" },
            { href: "/admin/orders?tab=tracking", label: "Tracking" },
            { href: "/admin/orders?tab=catalog", label: "Product Catalog" },
        ],
    },
    {
        href: "/admin/inventory",
        label: "Inventory",
        icon: Warehouse,
        subItems: [
            { href: "/admin/inventory?tab=shipments", label: "Shipments" },
            { href: "/admin/inventory?tab=po", label: "P.O. List" },
            { href: "/admin/inventory?tab=dr", label: "D.R. List" },
            { href: "/admin/inventory?tab=reports", label: "Reports" },
        ],
    },
    {
        href: "/admin/clients",
        label: "Clients",
        icon: Users,
        subItems: [
            { href: "/admin/clients", label: "Directory" },
            { href: "/admin/clients", label: "KYC Approvals" },
        ],
    },
];

function SidebarContent({
    pathname,
    items,
    onNavigate,
    adminName,
    adminInitials,
    roleLabel,
}: {
    pathname: string;
    items: NavItem[];
    onNavigate?: () => void;
    adminName?: string;
    adminInitials?: string;
    roleLabel?: string;
}) {
    const searchParams = useSearchParams();
    const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        items.forEach((item) => {
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
            <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
                <div className="w-8 h-8 flex items-center justify-center">
                    <Image src="/logo.jpg" alt="OBBO Logo" width={32} height={32} className="object-contain" />
                </div>
                <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
                    OBBO <span className="font-light opacity-70">iManage</span>
                </span>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {items.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const isExpanded = expanded[item.href];
                    return (
                        <div key={item.href} className="space-y-1">
                            {item.subItems ? (
                                <>
                                    <button
                                        onClick={() => toggleExpand(item.href)}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                            ? "bg-[var(--color-industrial-blue)]/25 text-sidebar-foreground border border-[var(--color-industrial-blue)]/35"
                                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <item.icon className="w-5 h-5 flex-shrink-0" />
                                            <span>{item.label}</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                    </button>
                                    {isExpanded && (
                                        <div className="pl-11 pr-3 py-1 space-y-1">
                                            {item.subItems.map((subItem) => {
                                                const subPath = subItem.href.split("?")[0];
                                                const subTab = subItem.href.includes("?") ? new URLSearchParams(subItem.href.split("?")[1]).get("tab") : null;
                                                const currentTab = searchParams.get("tab");
                                                const isSubActive = subTab
                                                    ? pathname === subPath && currentTab === subTab
                                                    : pathname === subPath || pathname.startsWith(`${subPath}/`);
                                                return (
                                                    <Link
                                                        key={subItem.href}
                                                        href={subItem.href}
                                                        onClick={onNavigate}
                                                        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${isSubActive
                                                            ? "bg-[var(--color-industrial-blue)]/20 text-sidebar-foreground border border-[var(--color-industrial-blue)]/30"
                                                            : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                                            }`}
                                                    >
                                                        {subItem.label}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Link
                                    href={item.href}
                                    onClick={onNavigate}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                        ? "bg-[var(--color-industrial-blue)]/25 text-sidebar-foreground border border-[var(--color-industrial-blue)]/35"
                                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                        }`}
                                >
                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                    <span className="flex-1">{item.label}</span>
                                </Link>
                            )}
                        </div>
                    );
                })}
            </nav>

            <div className="px-3 py-4 border-t border-sidebar-border">
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-sidebar-accent/40 border border-sidebar-border/60">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-industrial-blue)]/25 flex items-center justify-center">
                        <span className="text-xs font-bold text-sidebar-foreground">{adminInitials ?? "AD"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-sidebar-foreground truncate">{adminName ?? "Administrator"}</p>
                        <p className="text-xs text-sidebar-foreground/50 truncate">{roleLabel ?? "Administrator"}</p>
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
    const [role, setRole] = useState<"admin" | "warehouse_manager" | null>(null);

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
                        setAdminInitials(
                            name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                        );
                        setRole(profile?.role === "warehouse_manager" ? "warehouse_manager" : "admin");
                    });
            }
        });
    }, []);

    useEffect(() => {
        if (!role) return;

        if (role === "admin" && (pathname.startsWith("/admin/orders") || pathname.startsWith("/admin/inventory"))) {
            router.replace("/admin/dashboard");
            return;
        }

        if (role === "warehouse_manager" && pathname.startsWith("/admin/reports")) {
            router.replace("/admin/inventory");
        }
    }, [pathname, role, router]);

    async function handleSignOut() {
        const supabase = createClient();
        await supabase.auth.signOut();
        toast.success("Signed out.");
        router.push("/login");
        router.refresh();
    }

    return (
        <div className="min-h-screen flex bg-muted/30">
            <aside className="hidden lg:flex lg:w-64 flex-col bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 z-40">
                <SidebarContent
                    pathname={pathname}
                    items={role === "warehouse_manager" ? warehouseNavItems : adminNavItems}
                    adminName={adminName}
                    adminInitials={adminInitials}
                    roleLabel={role === "warehouse_manager" ? "Warehouse Manager" : "Administrator"}
                />
            </aside>

            <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
                <header className="h-16 bg-background/90 backdrop-blur border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger
                                className="inline-flex items-center justify-center rounded-md w-9 h-9 border border-border bg-card hover:bg-muted transition-colors lg:hidden"
                            >
                                <Menu className="w-5 h-5" />
                            </SheetTrigger>
                            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r border-sidebar-border">
                                <SidebarContent
                                    pathname={pathname}
                                    items={role === "warehouse_manager" ? warehouseNavItems : adminNavItems}
                                    onNavigate={() => setMobileOpen(false)}
                                    roleLabel={role === "warehouse_manager" ? "Warehouse Manager" : "Administrator"}
                                />
                            </SheetContent>
                        </Sheet>

                        <div className="hidden sm:block">
                            <h1 className="text-lg font-semibold text-foreground">
                                {(role === "warehouse_manager" ? warehouseNavItems : adminNavItems).find((i) => pathname.startsWith(i.href))?.label || "Admin"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell className="w-5 h-5" />
                        </Button>

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
