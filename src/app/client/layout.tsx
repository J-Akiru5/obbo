import Link from "next/link";
import { Package, LogOut, BarChart2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col bg-muted/30">
            {/* Client Topbar */}
            <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
                <Link href="/client/dashboard" className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[var(--color-industrial-blue)] flex items-center justify-center">
                        <Package className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-base font-bold text-[var(--color-industrial-blue)]">OBBO</span>
                </Link>
                <nav className="hidden sm:flex items-center gap-1">
                    <Link href="/client/dashboard">
                        <Button variant="ghost" size="sm" className="gap-1.5 text-sm"><BarChart2 className="w-4 h-4" />Dashboard</Button>
                    </Link>
                    <Link href="/client/dashboard">
                        <Button variant="ghost" size="sm" className="gap-1.5 text-sm"><ShoppingCart className="w-4 h-4" />Orders</Button>
                    </Link>
                </nav>
                <Link href="/login">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-sm text-muted-foreground">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </Button>
                </Link>
            </header>
            <main className="flex-1">{children}</main>
        </div>
    );
}
