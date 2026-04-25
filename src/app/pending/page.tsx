"use client";

import Link from "next/link";
import { Package, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function PendingVerificationPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-white px-4">
            <Card className="w-full max-w-md shadow-2xl shadow-[var(--color-industrial-blue)]/10 border-border text-center">
                <CardHeader className="pb-2 pt-10">
                    <div className="mx-auto w-20 h-20 rounded-full bg-[var(--color-industrial-yellow)]/10 flex items-center justify-center mb-4">
                        <Clock className="w-10 h-10 text-[var(--color-industrial-yellow)] animate-pulse" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Pending Verification</h1>
                </CardHeader>
                <CardContent className="space-y-6 pb-10">
                    <p className="text-muted-foreground leading-relaxed">
                        Your account is currently under review. An administrator will verify your details and approve your access shortly.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                        <p className="font-semibold mb-1">What happens next?</p>
                        <ul className="list-disc list-inside space-y-1 text-left">
                            <li>Our team reviews your submitted information</li>
                            <li>You&apos;ll receive access once approved</li>
                            <li>You can then browse the catalog and place orders</li>
                        </ul>
                    </div>
                    <Link href="/">
                        <Button variant="outline" className="gap-2">
                            <ArrowLeft className="w-4 h-4" /> Back to Home
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
