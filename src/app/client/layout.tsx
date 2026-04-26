"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Package, LogOut, BarChart2, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [fullName, setFullName] = useState<string>("");

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                // Try profile table first, fall back to metadata
                supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", data.user.id)
                    .single()
                    .then(({ data: profile }) => {
                        setFullName(
                            profile?.full_name ||
                            data.user?.user_metadata?.full_name ||
                            data.user?.email?.split("@")[0] ||
                            "Client"
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

    const navItems = [
        { href: "/client/dashboard", label: "Dashboard", icon: BarChart2 },
        { href: "/client/orders", label: "Orders", icon: ShoppingCart },
        { href: "/client/profile", label: "My Profile", icon: User },
    ];

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
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link key={item.href} href={item.href}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`gap-1.5 text-sm ${isActive
                                        ? "bg-[var(--color-industrial-blue)]/10 text-[var(--color-industrial-blue)] font-semibold"
                                        : "text-muted-foreground"
                                        }`}
                                >
                                    <item.icon className="w-4 h-4" />
                                    {item.label}
                                </Button>
                            </Link>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-3">
                    {fullName && (
                        <span className="hidden sm:block text-sm text-muted-foreground">
                            {fullName}
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-sm text-muted-foreground"
                        onClick={handleSignOut}
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </Button>
                </div>
            </header>

            <main className="flex-1">{children}</main>
        </div>
    );
}
