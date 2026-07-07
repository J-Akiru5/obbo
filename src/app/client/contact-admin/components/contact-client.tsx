'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, Clock, MapPin, Building, Copy } from 'lucide-react';
import { toast } from 'sonner';

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied to clipboard!`);
  });
}

export default function ContactClient({ contactInfo }: { contactInfo: any }) {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold tracking-tight">Contact Admin</h2>
        <p className="text-muted-foreground text-sm">
          Get in touch with OBBO Holdings Inc. for support or inquiries.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader className="bg-muted/30 rounded-t-xl border-b pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="h-5 w-5 text-[var(--color-industrial-blue)]" />
              Official Support Channels
            </CardTitle>
            <CardDescription>
              Reach out to us via phone or email during business hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-full bg-[var(--color-industrial-blue)]/10 p-3 text-[var(--color-industrial-blue)] dark:text-blue-400">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-foreground text-sm font-semibold">Phone Number</h4>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-muted-foreground text-sm">
                    {contactInfo?.phone || '+63 900 000 0000'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(contactInfo?.phone || '+63 900 000 0000', 'Phone number')
                    }
                    className="text-muted-foreground/70 hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  Available during business hours
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-status-pending-bg text-status-pending-text shrink-0 rounded-full p-3">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-foreground text-sm font-semibold">Email Address</h4>
                <div className="mt-1 flex items-center gap-2">
                  <a
                    href={`mailto:${contactInfo?.email || 'support@obbo.com'}`}
                    className="text-sm text-[var(--color-industrial-blue)] hover:underline dark:text-blue-400"
                  >
                    {contactInfo?.email || 'support@obbo.com'}
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(contactInfo?.email || 'support@obbo.com', 'Email')
                    }
                    className="text-muted-foreground/70 hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  We aim to respond within 24 hours
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-status-success-bg text-status-success-text shrink-0 rounded-full p-3">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-foreground text-sm font-semibold">Business Hours</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  {contactInfo?.hours || 'Mon-Fri 8:00 AM - 5:00 PM'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-muted text-muted-foreground shrink-0 rounded-full p-3">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-foreground text-sm font-semibold">Office Location</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  {contactInfo?.address || 'OBBO Holdings Inc. Main Office'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none bg-gradient-to-br from-[var(--color-industrial-blue)] to-blue-900 text-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-blue-50">Need Immediate Assistance?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-blue-100">
                For urgent order modifications, dispatch delays, or payment verifications, please
                contact your dedicated account manager directly via phone.
              </p>
              <div className="mt-6 rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <p className="mb-1 text-xs tracking-wider text-blue-200 uppercase">
                  Direct Hotline
                </p>
                <p className="font-mono text-xl font-bold">
                  {contactInfo?.phone || '+63 900 000 0000'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-status-pending-border bg-status-pending-bg shadow-sm">
            <CardContent className="pt-6">
              <h4 className="text-foreground mb-2 font-semibold">Important Notice</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Please ensure all POs and delivery schedules are submitted before the daily cutoff
                time (2:00 PM) to guarantee processing for the next business day.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
