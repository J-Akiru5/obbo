"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
    Package,
    LayoutDashboard,
    ShoppingCart,
    Warehouse,
    Users,
    Menu,
    X,
    LogOut,
    Bell,
    ChevronDown,
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

const navItems = [
    { 
        href: "/admin/dashboard", 
        label: "Dashboard", 
        icon: LayoutDashboard,
        subItems: [
            { href: "/admin/dashboard", label: "Overview" }
        ]
    },
    { 
        href: "/admin/orders", 
        label: "Orders", 
        icon: ShoppingCart,
        subItems: [
            { href: "/admin/orders", label: "Order Pipeline" },
            { href: "/admin/orders", label: "Product Catalog" }
        ]
    },
    { 
        href: "/admin/inventory", 
        label: "Inventory", 
        icon: Warehouse,
        subItems: [
            { href: "/admin/inventory", label: "Shipments" },
            { href: "/admin/inventory", label: "P.O. List" },
            { href: "/admin/inventory", label: "D.R. List" },
            { href: "/admin/inventory", label: "Reports" }
        ]
    },
    { 
        href: "/admin/clients", 
        label: "Clients", 
        icon: Users,
        subItems: [
            { href: "/admin/clients", label: "Directory" },
            { href: "/admin/clients", label: "KYC Approvals" }
        ]
    },
];

function SidebarContent({ pathname, onNavigate, adminName, adminInitials }: { pathname: string; onNavigate?: () => void; adminName?: string; adminInitials?: string }) {
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
                    <img src="/logo.png" alt="OBBO Logo" className="w-full h-full object-contain" />
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

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", data.user.id)
                    .single()
                    .then(({ data: profile }) => {
                        const name = profile?.full_name || data.user?.email?.split("@")[0] || "Admin";
                        setAdminName(name);
                        setAdminInitials(
                            name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                        );
                    });
            }
        });
    }, []);

    async function handleSignOut() {
        const supabase = createClient();
        await supabase.auth.signOut();
        toast.success("Signed out.");
        router.push("/login");
        router.refresh();
    }

    return (
        <div className="min-h-screen flex bg-muted/30">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex lg:w-64 flex-col bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 z-40">
                <SidebarContent pathname={pathname} adminName={adminName} adminInitials={adminInitials} />
            </aside>

            {/* Main Content */}
            <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
                {/* Top Bar */}
                <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        {/* Mobile menu */}
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger
                                className="inline-flex items-center justify-center rounded-md w-9 h-9 hover:bg-accent hover:text-accent-foreground transition-colors lg:hidden"
                            >
                                <Menu className="w-5 h-5" />
                            </SheetTrigger>
                            <SheetContent side="left" className="w-64 p-0 bg-sidebar">
                                <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                            </SheetContent>
                        </Sheet>

                        <div className="hidden sm:block">
                            <h1 className="text-lg font-semibold text-foreground">
                                {navItems.find((i) => pathname.startsWith(i.href))?.label || "Admin"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--color-industrial-red)] text-white text-[10px] font-bold flex items-center justify-center">
                                3
                            </span>
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
