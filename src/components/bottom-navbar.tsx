"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
    LayoutDashboard, 
    Package, 
    Users, 
    Warehouse, 
    Settings 
} from "lucide-react";

const NAV_ITEMS = [
    { 
        href: "/admin/dashboard", 
        label: "Home", 
        icon: LayoutDashboard 
    },
    { 
        href: "/admin/products", 
        label: "Inventory", 
        icon: Package 
    },
    { 
        href: "/admin/clients", 
        label: "Clients", 
        icon: Users 
    },
    { 
        href: "/admin/reports", 
        label: "Reports", 
        icon: Warehouse 
    },
    { 
        href: "/admin/settings", 
        label: "Settings", 
        icon: Settings 
    }
];

export function BottomNavbar() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-background/80 px-2 pb-safe backdrop-blur-md lg:hidden">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="relative flex flex-col items-center justify-center gap-1 min-w-[64px]"
                    >
                        <div 
                            className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                                isActive 
                                    ? "bg-[var(--color-industrial-blue)] text-white" 
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <item.icon className="h-5 w-5" />
                        </div>
                        <span 
                            className={`text-[10px] font-medium transition-colors ${
                                isActive ? "text-[var(--color-industrial-blue)]" : "text-muted-foreground"
                            }`}
                        >
                            {item.label}
                        </span>
                        {isActive && (
                            <div className="absolute -top-1 h-1 w-1 rounded-full bg-[var(--color-industrial-blue)]" />
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
