'use client';

import Link from 'next/link';
import { Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function PendingVerificationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-white px-4">
      <Card className="shadow-primary/10 border-border w-full max-w-md text-center shadow-2xl">
        <CardHeader className="pt-10 pb-2">
          <div className="bg-accent/10 mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full">
            <Clock className="text-accent h-10 w-10 animate-pulse" />
          </div>
          <h1 className="text-foreground text-2xl font-bold">Pending Verification</h1>
        </CardHeader>
        <CardContent className="space-y-6 pb-10">
          <p className="text-muted-foreground leading-relaxed">
            Your account is currently under review. An administrator will verify your details and
            approve your access shortly.
          </p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="mb-1 font-semibold">What happens next?</p>
            <ul className="list-inside list-disc space-y-1 text-left">
              <li>Our team reviews your submitted information</li>
              <li>You&apos;ll receive access once approved</li>
              <li>You can then browse the catalog and place orders</li>
            </ul>
          </div>
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
