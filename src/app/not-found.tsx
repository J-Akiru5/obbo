import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileSearch } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-background text-foreground p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/70 text-primary">
                <FileSearch className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight">Page Not Found</h1>
                <p className="text-sm text-muted-foreground max-w-sm">
                    The page you are looking for doesn't exist or has been moved to another path.
                </p>
            </div>
            <Link href="/">
                <Button className="bg-primary hover:bg-primary/90 mt-2">
                    Go Back Home
                </Button>
            </Link>
        </div>
    );
}