"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // Prevent hydration mismatch
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                <div className="h-4 w-4" />
            </Button>
        );
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg transition-colors hover:bg-muted"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
            {theme === "dark" ? (
                <Sun className="h-4 w-4 text-[var(--color-industrial-yellow)] transition-all" />
            ) : (
                <Moon className="h-4 w-4 text-[var(--color-industrial-blue)] transition-all" />
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
