import Link from "next/link";
import { Clock, PackageSearch, Contact, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
    title: "Verification Pending | OBBO iManage",
};

export default function ClientPendingKycPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="w-full max-w-lg space-y-6">
                {/* Icon + heading */}
                <div className="text-center space-y-4">
                    <div className="mx-auto w-20 h-20 rounded-full bg-status-pending-bg border-4 border-status-pending-border flex items-center justify-center">
                        <Clock className="w-9 h-9 text-status-pending-text animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">
                            KYC Verification Pending
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                            This feature requires a verified account. Your documents are under review — once approved, you&apos;ll have full portal access automatically.
                        </p>
                    </div>
                </div>

                {/* Status card */}
                <Card className="border-status-pending-border bg-status-pending-bg/60">
                    <CardContent className="pt-5 pb-5 space-y-4">
                        <div className="flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-status-pending-text shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">What&apos;s locked?</p>
                                <ul className="text-sm text-muted-foreground space-y-0.5 list-disc list-inside">
                                    <li>Placing new orders</li>
                                    <li>Balance ledger &amp; re-delivery requests</li>
                                </ul>
                            </div>
                        </div>
                        <div className="border-t border-status-pending-border pt-4 flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-status-success-text flex items-center justify-center shrink-0 mt-0.5">
                                <svg className="w-3 h-3 text-status-success-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-sm font-semibold text-foreground">What you can do now</p>
                                <ul className="text-sm text-muted-foreground space-y-0.5 list-disc list-inside">
                                    <li>Browse the full product catalog</li>
                                    <li>View your dashboard &amp; notifications</li>
                                    <li>Manage your profile &amp; settings</li>
                                    <li>Contact our admin team</li>
                                </ul>
                            </div>
                        </div>
                        <div className="border-t border-status-pending-border pt-3">
                            <p className="text-xs text-muted-foreground">
                                ⏱ Accounts are typically reviewed within <span className="font-semibold text-foreground">1–2 business days</span>.
                                You&apos;ll be automatically unlocked once verified — no need to log out and back in.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/client/catalog" className="flex-1">
                        <Button
                            className="w-full bg-[var(--color-industrial-blue)] hover:bg-[var(--color-industrial-blue)]/90 gap-2"
                        >
                            <PackageSearch className="w-4 h-4" />
                            Browse Catalog
                            <ArrowRight className="w-4 h-4 ml-auto" />
                        </Button>
                    </Link>
                    <Link href="/client/contact-admin" className="flex-1">
                        <Button variant="outline" className="w-full gap-2">
                            <Contact className="w-4 h-4" />
                            Contact Admin
                        </Button>
                    </Link>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                    Questions?{" "}
                    <Link href="/client/contact-admin" className="text-[var(--color-industrial-blue)] hover:underline font-medium">
                        Message our team
                    </Link>{" "}
                    and we&apos;ll get back to you.
                </p>
            </div>
        </div>
    );
}
