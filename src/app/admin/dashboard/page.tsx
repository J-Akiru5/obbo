import { createClient } from "@/lib/supabase/server";
import { 
    fetchDashboardKPIs, 
    fetchActivityFeed, 
    fetchShipments, 
    fetchOrders 
} from "@/lib/actions/admin-actions";
import DashboardClient from "./dashboard-client";
import type { Order, ActivityLog } from "@/lib/types/database";

export default async function AdminDashboardPage() {
    // 1. Authenticate and get role on the server
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let userRole = null;
    if (user) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
        userRole = profile?.role || null;
    }

    // 2. Fetch data in parallel on the server (skip order data for admin role)
    const isAdmin = userRole === "admin";
    const [kpiData, feed, ships, pOrders] = await Promise.all([
        fetchDashboardKPIs(),
        fetchActivityFeed(20),
        isAdmin ? Promise.resolve([]) : fetchShipments(),
        isAdmin ? Promise.resolve([]) : fetchOrders("pending")
    ]);

    return (
        <DashboardClient 
            initialKpis={kpiData}
            initialActivityFeed={feed as ActivityLog[]}
            initialShipments={ships as any[]}
            initialRecentOrders={(pOrders as Order[]).slice(0, 5)}
            initialUserRole={userRole}
        />
    );
}
