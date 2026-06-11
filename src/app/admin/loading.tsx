export default function AdminLoading() {
    return (
        <div className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-4 bg-background">
            <div className="relative flex items-center justify-center">
                {/* Outer Spinning Ring */}
                <div className="animate-spin rounded-full border-4 border-muted border-t-primary h-12 w-12" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
                Loading Admin Portal...
            </p>
        </div>
    );
}