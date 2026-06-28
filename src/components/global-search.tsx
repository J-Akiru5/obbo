'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  FileText,
  Package,
  Users,
  Settings,
  LayoutDashboard,
  Truck,
  FileOutput,
  ClipboardList,
  PackageSearch,
  WalletCards,
  CircleUserRound,
  Contact,
} from 'lucide-react';
import { Command } from 'cmdk';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isClient = pathname?.startsWith('/client');

  const [role, setRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            setRole(profile?.role || null);
          });
      }
    });
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="bg-muted/50 text-muted-foreground relative h-9 w-9 justify-center rounded-lg p-0 shadow-none lg:h-9 lg:w-64 lg:justify-start lg:px-4"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 lg:mr-2" />
        <span className="hidden lg:inline-flex">Search for anything...</span>
        <kbd className="bg-muted pointer-events-none absolute top-[0.3rem] right-[0.3rem] hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none lg:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Global Search"
        className="border-border/50 bg-background text-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border shadow-2xl"
      >
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Command.Input
            placeholder="Type a command or search..."
            className="placeholder:text-muted-foreground flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <Command.List className="max-h-[300px] overflow-x-hidden overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm">No results found.</Command.Empty>

          {!isClient ? (
            <>
              <Command.Group
                heading="Pages"
                className="text-muted-foreground px-2 py-1.5 text-xs font-semibold"
              >
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/admin/dashboard'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/admin/products'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <Package className="h-4 w-4" />
                  <span>Products Catalog</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/admin/clients'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <Users className="h-4 w-4" />
                  <span>Clients & Users</span>
                </Command.Item>
              </Command.Group>

              <Command.Group
                heading="Inventory & Orders"
                className="text-muted-foreground px-2 py-1.5 text-xs font-semibold"
              >
                {role === 'warehouse_manager' && (
                  <Command.Item
                    onSelect={() => runCommand(() => router.push('/admin/orders?tab=new'))}
                    className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                  >
                    <FileText className="h-4 w-4" />
                    <span>New Order Requests</span>
                  </Command.Item>
                )}
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/admin/inventory?tab=shipments'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <Truck className="h-4 w-4" />
                  <span>Shipments</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/admin/reports'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <FileOutput className="h-4 w-4" />
                  <span>Warehouse Reports</span>
                </Command.Item>
              </Command.Group>

              <Command.Group
                heading="System"
                className="text-muted-foreground px-2 py-1.5 text-xs font-semibold"
              >
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/admin/settings'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <Settings className="h-4 w-4" />
                  <span>System Settings</span>
                </Command.Item>
              </Command.Group>
            </>
          ) : (
            <>
              <Command.Group
                heading="Client Portal"
                className="text-muted-foreground px-2 py-1.5 text-xs font-semibold"
              >
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/client/dashboard'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/client/catalog'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <PackageSearch className="h-4 w-4" />
                  <span>Product Catalog</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/client/orders'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <ClipboardList className="h-4 w-4" />
                  <span>My Orders</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/client/ledger'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <WalletCards className="h-4 w-4" />
                  <span>Balance Ledger</span>
                </Command.Item>
              </Command.Group>

              <Command.Group
                heading="Account"
                className="text-muted-foreground px-2 py-1.5 text-xs font-semibold"
              >
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/client/profile'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <CircleUserRound className="h-4 w-4" />
                  <span>Profile & Settings</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => runCommand(() => router.push('/client/contact-admin'))}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none"
                >
                  <Contact className="h-4 w-4" />
                  <span>Contact Support</span>
                </Command.Item>
              </Command.Group>
            </>
          )}
        </Command.List>
      </Command.Dialog>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-all"
          aria-hidden="true"
        />
      )}
    </>
  );
}
