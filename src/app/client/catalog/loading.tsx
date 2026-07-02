import { Skeleton } from '@/components/ui/skeleton';

export default function ClientCatalogLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Skeleton className="h-6 w-48" />

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-xl border p-4 shadow-sm">
            <Skeleton className="mb-3 h-48 w-full rounded-lg" />
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="mb-1 h-3 w-1/2" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
