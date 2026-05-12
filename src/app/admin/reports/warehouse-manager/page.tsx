"use client";

import { ReportsTab } from "../../inventory/components/reports-tab";

export default function WarehouseManagerReportsPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight">Daily Warehouse Reports</h2>
                <p className="text-muted-foreground">
                    Generate, review, and submit daily inventory reconciliation reports to Admin.
                </p>
            </div>

            <div className="border-t pt-6">
                <ReportsTab />
            </div>
        </div>
    );
}
