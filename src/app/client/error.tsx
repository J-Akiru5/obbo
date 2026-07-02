'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ClientError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[client error]', error);
  }, [error]);

  return (
    <div className="bg-background text-foreground flex min-h-screen w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="bg-destructive/10 text-destructive flex h-16 w-16 items-center justify-center rounded-2xl">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          An unexpected error occurred. Please try again or contact support if the issue persists.
        </p>
      </div>
      <Button onClick={reset} className="mt-2">
        Try again
      </Button>
    </div>
  );
}
