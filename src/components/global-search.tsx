"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Package, Users, Settings, LayoutDashboard, Truck, FileOutput } from "lucide-react";
import { Command } from "cmdk";
import { Button } from "@/components/ui/button";

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-[0.5rem] bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <span className="hidden lg:inline-flex"><Search className="mr-2 h-4 w-4" /> Search for anything...</span>
        <span className="inline-flex lg:hidden"><Search className="h-4 w-4" /></span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Global Search"
        className="fixed top-1/2 left-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border/50 bg-background text-foreground shadow-2xl z-50 flex flex-col max-h-[85vh] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      >
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Command.Input 
            placeholder="Type a command or search..." 
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
          <Command.Empty className="py-6 text-center text-sm">No results found.</Command.Empty>

          <Command.Group heading="Pages" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            <Command.Item 
                onSelect={() => runCommand(() => router.push("/admin/dashboard"))}
                className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Command.Item>
            <Command.Item 
                onSelect={() => runCommand(() => router.push("/admin/products"))}
                className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
            >
              <Package className="h-4 w-4" />
              <span>Products Catalog</span>
            </Command.Item>
            <Command.Item 
                onSelect={() => runCommand(() => router.push("/admin/clients"))}
                className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
            >
              <Users className="h-4 w-4" />
              <span>Clients & Users</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Inventory & Orders" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            <Command.Item 
                onSelect={() => runCommand(() => router.push("/admin/orders?tab=new"))}
                className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
            >
              <FileText className="h-4 w-4" />
              <span>New Order Requests</span>
            </Command.Item>
            <Command.Item 
                onSelect={() => runCommand(() => router.push("/admin/inventory?tab=shipments"))}
                className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
            >
              <Truck className="h-4 w-4" />
              <span>Shipments</span>
            </Command.Item>
            <Command.Item 
                onSelect={() => runCommand(() => router.push("/admin/reports"))}
                className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
            >
              <FileOutput className="h-4 w-4" />
              <span>Warehouse Reports</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="System" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            <Command.Item 
                onSelect={() => runCommand(() => router.push("/admin/settings"))}
                className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
            >
              <Settings className="h-4 w-4" />
              <span>System Settings</span>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
      
      {open && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-all" aria-hidden="true" />}
    </>
  );
}
