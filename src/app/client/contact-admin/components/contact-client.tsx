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
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Contact Admin</h2>
                <p className="text-sm text-gray-500">Get in touch with OBBO Holdings Inc. for support or inquiries.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="shadow-sm border-[var(--color-industrial-blue)]/20">
                    <CardHeader className="pb-4 bg-slate-50 border-b rounded-t-xl">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Building className="w-5 h-5 text-[var(--color-industrial-blue)]" />
                            Official Support Channels
                        </CardTitle>
                        <CardDescription>Reach out to us via phone or email during business hours.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-blue-50 text-[var(--color-industrial-blue)] shrink-0">
                                <Phone className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900">Phone Number</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-sm text-gray-600">{contactInfo?.phone || "+63 900 000 0000"}</p>
                                    <button type="button" onClick={() => copyToClipboard(contactInfo?.phone || "+63 900 000 0000", "Phone number")} className="text-gray-400 hover:text-gray-600">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Available during business hours</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-amber-50 text-amber-600 shrink-0">
                                <Mail className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900">Email Address</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <a href={`mailto:${contactInfo?.email || "support@obbo.com"}`} className="text-sm text-[var(--color-industrial-blue)] hover:underline">
                                        {contactInfo?.email || "support@obbo.com"}
                                    </a>
                                    <button type="button" onClick={() => copyToClipboard(contactInfo?.email || "support@obbo.com", "Email")} className="text-gray-400 hover:text-gray-600">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">We aim to respond within 24 hours</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900">Business Hours</h4>
                                <p className="text-sm text-gray-600 mt-1">{contactInfo?.hours || "Mon-Fri 8:00 AM - 5:00 PM"}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-gray-100 text-gray-600 shrink-0">
                                <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900">Office Location</h4>
                                <p className="text-sm text-gray-600 mt-1">{contactInfo?.address || "OBBO Holdings Inc. Main Office"}</p>
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

                    <Card className="shadow-sm border-amber-200 bg-amber-50">
                        <CardContent className="pt-6">
                            <h4 className="font-semibold text-amber-900 mb-2">Important Notice</h4>
                            <p className="text-sm text-amber-800 leading-relaxed">
                                Please ensure all POs and delivery schedules are submitted before the daily cutoff time (2:00 PM) to guarantee processing for the next business day. 
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
