import { Skeleton } from '@/components/ui/skeleton';

export default function ClientOrdersLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Tab Bar */}
      <div className="border-border bg-muted flex gap-1 rounded-lg border p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 flex-1 rounded-md" />
        ))}
      </div>

      {/* Order Cards */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-xl border p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
