'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gauge, ClipboardList, WalletCards, CircleUserRound, Plus, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClientKyc } from '@/lib/context/client-kyc-context';

// Mirrors the sidebar's own lock convention in client/layout.tsx: only
// Balance Ledger is actually gated pre-verification (proxy.ts blocks
// /client/ledger outright for unverified clients — see RESTRICTED_PATHS).
// My Orders and the catalog quick-order button are NOT gated there, so
// they don't show a lock here either — a lock icon on something that
// isn't really locked would just be a UI lie.
const LEFT_ITEMS = [
  { href: '/client/dashboard', label: 'Home', icon: Gauge, locked: false },
  { href: '/client/orders', label: 'Orders', icon: ClipboardList, locked: false },
];
const RIGHT_ITEMS = [
  { href: '/client/ledger', label: 'Ledger', icon: WalletCards, locked: true },
  { href: '/client/profile', label: 'Profile', icon: CircleUserRound, locked: false },
];

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  showLock,
}: {
  href: string;
  label: string;
  icon: typeof Gauge;
  isActive: boolean;
  showLock: boolean;
}) {
  return (
    <Link
      href={href}
      className="relative flex min-w-[56px] flex-1 flex-col items-center justify-center gap-1"
    >
      <div
        className={cn(
          'flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Icon className="h-5 w-5" />
        {showLock && (
          <Lock className="text-status-pending-text bg-background absolute top-0 right-2.5 h-3 w-3 rounded-full p-0.5" />
        )}
      </div>
      <span
        className={cn(
          'text-[10px] font-medium transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      {isActive && <div className="bg-primary absolute -top-1 h-1 w-1 rounded-full" />}
    </Link>
  );
}

// Client-portal mobile bottom nav — deliberately separate from (not a
// replacement for) the header hamburger/Sheet menu, which still carries
// Contact Admin, Sign Out, and everything else. This is just a fast-access
// strip for the four most common destinations plus a raised center button
// for starting a quick order, matching the FAB-in-tabbar pattern (e.g.
// Instagram/TikTok's center create button).
export function ClientBottomNavbar() {
  const pathname = usePathname();
  const { kycStatus } = useClientKyc();
  const isUnverified = kycStatus !== 'verified';

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-50 lg:hidden">
      <div className="border-border bg-background/80 pb-safe flex h-16 items-center justify-around border-t px-2 backdrop-blur-md">
        {LEFT_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            isActive={pathname.startsWith(item.href)}
            showLock={isUnverified && item.locked}
          />
        ))}
        {/* Reserved gap so the side items don't collide with the raised center button */}
        <div className="w-14 shrink-0" aria-hidden="true" />
        {RIGHT_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            isActive={pathname.startsWith(item.href)}
            showLock={isUnverified && item.locked}
          />
        ))}
      </div>

      <Link
        href="/client/catalog"
        aria-label="Quick order — browse product catalog"
        className="bg-primary text-primary-foreground ring-background active:bg-primary/90 absolute top-[-22px] left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full shadow-lg ring-4 transition-transform active:scale-95"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </Link>
    </nav>
  );
}
