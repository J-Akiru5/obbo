export default function ClientLoading() {
  return (
    <div className="bg-background flex min-h-[60vh] w-full flex-col items-center justify-center gap-4">
      <div className="relative flex items-center justify-center">
        {/* Outer Spinning Ring */}
        <div className="border-muted border-t-primary h-12 w-12 animate-spin rounded-full border-4" />
      </div>
      <p className="text-muted-foreground animate-pulse text-xs font-semibold tracking-[0.2em] uppercase">
        Loading Your Dashboard...
      </p>
    </div>
  );
}
