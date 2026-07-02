import { Skeleton } from '@/components/ui/skeleton';

export default function ClientLedgerLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-xl border p-5 shadow-sm">
            <Skeleton className="mb-3 h-4 w-32" />
            <Skeleton className="mb-2 h-8 w-28" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Ledger Table */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <Skeleton className="mb-4 h-5 w-36" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="border-border flex items-center gap-4 border-b pb-3 last:border-0"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
