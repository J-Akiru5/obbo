import { BriefcaseBusiness, Clock3, Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminContact } from "@/lib/client-portal-data";

export default function ClientContactAdminPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Contact Admin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          For any concerns, please use the official channels below.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BriefcaseBusiness className="h-4 w-4 text-[var(--color-industrial-blue)]" /> Official Contact Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Mail className="mt-0.5 h-4 w-4 text-[var(--color-industrial-blue)]" />
            <div>
              <p className="text-sm font-medium">Business Email Address</p>
              <p className="text-sm text-muted-foreground">{adminContact.email}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Phone className="mt-0.5 h-4 w-4 text-[var(--color-industrial-blue)]" />
            <div>
              <p className="text-sm font-medium">Phone Number</p>
              <p className="text-sm text-muted-foreground">{adminContact.phone}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Clock3 className="mt-0.5 h-4 w-4 text-[var(--color-industrial-blue)]" />
            <div>
              <p className="text-sm font-medium">Business Hours</p>
              <p className="text-sm text-muted-foreground">{adminContact.businessHours}</p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            No direct messaging form is available in this portal. Please contact the admin through the channels above.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
