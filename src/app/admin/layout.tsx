"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
    { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
    { href: "/admin/clients", label: "Clients", icon: Users },
];

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-industrial-yellow)] flex items-center justify-center">
                    <Package className="w-4 h-4 text-[var(--color-industrial-blue)]" />
                </div>
                <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
                    OBBO <span className="font-light opacity-70">iManage</span>
                </span>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                }`}
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            <span>{item.label}</span>
                            {item.label === "Orders" && (
                                <Badge className="ml-auto bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] text-xs px-1.5 py-0 hover:bg-[var(--color-industrial-yellow)]">
                                    2
                                </Badge>
                            )}
                            {item.label === "Clients" && (
                                <Badge className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0 hover:bg-red-500">
                                    2
                                </Badge>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* User info */}
            <div className="px-3 py-4 border-t border-sidebar-border">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                        <span className="text-xs font-bold text-sidebar-accent-foreground">JD</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-sidebar-foreground truncate">Juan Dela Cruz</p>
                        <p className="text-xs text-sidebar-foreground/50 truncate">Administrator</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="min-h-screen flex bg-muted/30">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex lg:w-64 flex-col bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 z-40">
                <SidebarContent pathname={pathname} />
            </aside>

            {/* Main Content */}
            <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
                {/* Top Bar */}
                <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        {/* Mobile menu */}
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="lg:hidden">
                                    <Menu className="w-5 h-5" />
                                </Button>
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
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="gap-2 px-2">
                                    <Avatar className="w-8 h-8">
                                        <AvatarFallback className="bg-[var(--color-industrial-blue)] text-white text-xs font-bold">JD</AvatarFallback>
                                    </Avatar>
                                    <span className="hidden sm:block text-sm font-medium">Admin</span>
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem>Profile</DropdownMenuItem>
                                <DropdownMenuItem>Settings</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
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
