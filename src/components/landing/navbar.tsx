"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
            <Image src="/logo.png" alt="OBBO iManage Logo" width={36} height={36} className="object-contain" />
          </div>
          <span className="text-xl font-bold tracking-tight text-primary">
            OBBO <span className="font-light">iManage</span>
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">Features</a>
          <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">How It Works</a>
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" className="font-semibold">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button className="bg-primary hover:bg-primary/90 font-semibold transition-transform duration-200 hover:scale-105">
              Get Started
            </Button>
          </Link>
        </div>
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button className="p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden bg-background border-b border-border px-4 py-4 space-y-3 animate-in slide-in-from-top-2">
          <a href="#features" onClick={() => setMobileOpen(false)} className="block text-sm font-medium py-2">Features</a>
          <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm font-medium py-2">How It Works</a>
          <Link href="/login" onClick={() => setMobileOpen(false)}>
            <Button variant="ghost" className="w-full justify-start font-semibold">Sign In</Button>
          </Link>
          <Link href="/register" onClick={() => setMobileOpen(false)}>
            <Button className="w-full bg-primary hover:bg-primary/90 font-semibold">
              Get Started
            </Button>
          </Link>
        </div>
      )}
    </nav>
  );
}
