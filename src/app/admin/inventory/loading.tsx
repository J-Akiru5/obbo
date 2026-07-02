import { Skeleton } from '@/components/ui/skeleton';

export default function AdminInventoryLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Tab Bar */}
      <div className="border-border bg-muted flex gap-1 rounded-lg border p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 flex-1 rounded-md" />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Table Rows */}
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
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
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
