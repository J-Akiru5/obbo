"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Clock, MapPin, Building, Copy } from "lucide-react";
import { toast } from "sonner";

function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
        toast.success(`${label} copied to clipboard!`);
    });
}

export default function ContactClient({ contactInfo }: { contactInfo: any }) {
    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Contact Admin</h2>
                <p className="text-sm text-muted-foreground">Get in touch with OBBO Holdings Inc. for support or inquiries.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="shadow-sm border-border">
                    <CardHeader className="pb-4 bg-muted/30 border-b rounded-t-xl">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Building className="w-5 h-5 text-[var(--color-industrial-blue)]" />
                            Official Support Channels
                        </CardTitle>
                        <CardDescription>Reach out to us via phone or email during business hours.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-[var(--color-industrial-blue)]/10 text-[var(--color-industrial-blue)] dark:text-blue-400 shrink-0">
                                <Phone className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-foreground">Phone Number</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-sm text-muted-foreground">{contactInfo?.phone || "+63 900 000 0000"}</p>
                                    <button type="button" onClick={() => copyToClipboard(contactInfo?.phone || "+63 900 000 0000", "Phone number")} className="text-muted-foreground/70 hover:text-foreground">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground/60 mt-1">Available during business hours</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-status-pending-bg text-status-pending-text shrink-0">
                                <Mail className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-foreground">Email Address</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <a href={`mailto:${contactInfo?.email || "support@obbo.com"}`} className="text-sm text-[var(--color-industrial-blue)] dark:text-blue-400 hover:underline">
                                        {contactInfo?.email || "support@obbo.com"}
                                    </a>
                                    <button type="button" onClick={() => copyToClipboard(contactInfo?.email || "support@obbo.com", "Email")} className="text-muted-foreground/70 hover:text-foreground">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground/60 mt-1">We aim to respond within 24 hours</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-status-success-bg text-status-success-text shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-foreground">Business Hours</h4>
                                <p className="text-sm text-muted-foreground mt-1">{contactInfo?.hours || "Mon-Fri 8:00 AM - 5:00 PM"}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-muted text-muted-foreground shrink-0">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-foreground">Office Location</h4>
                                <p className="text-sm text-muted-foreground mt-1">{contactInfo?.address || "OBBO Holdings Inc. Main Office"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="shadow-sm bg-gradient-to-br from-[var(--color-industrial-blue)] to-blue-900 text-white border-none">
                        <CardHeader>
                            <CardTitle className="text-blue-50">Need Immediate Assistance?</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-blue-100 text-sm leading-relaxed">
                                For urgent order modifications, dispatch delays, or payment verifications, please contact your dedicated account manager directly via phone.
                            </p>
                            <div className="mt-6 p-4 bg-white/10 rounded-lg border border-white/20 backdrop-blur-sm">
                                <p className="text-xs text-blue-200 uppercase tracking-wider mb-1">Direct Hotline</p>
                                <p className="font-mono text-xl font-bold">{contactInfo?.phone || "+63 900 000 0000"}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-status-pending-border bg-status-pending-bg">
                        <CardContent className="pt-6">
                            <h4 className="font-semibold text-foreground mb-2">Important Notice</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Please ensure all POs and delivery schedules are submitted before the daily cutoff time (2:00 PM) to guarantee processing for the next business day. 
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
