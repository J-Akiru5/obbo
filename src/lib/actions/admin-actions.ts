"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// ─── Helper: ensure caller is admin or warehouse manager ─────
async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    if (profile?.role !== "admin" && profile?.role !== "warehouse_manager") {
        throw new Error("Forbidden");
    }
    return { supabase, userId: user.id };
}

// ─── Helper: ensure caller is admin only ────────────────────
async function requireAdminOnly() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
    if (profile?.role !== "admin") {
        throw new Error("Forbidden");
    }
    return { supabase, userId: user.id };
}

// ─── Helper: audit log ──────────────────────────────────────
async function logActivity(
    supabase: Awaited<ReturnType<typeof createClient>>,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>
) {
    await supabase.from("activity_log").insert({
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata: metadata ?? {},
    });
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

export async function fetchDashboardKPIs() {
    const { supabase } = await requireAdmin();

    const [shipments, balances, pendingOrders, pendingKyc, activeClients, pendingFulfillment] = await Promise.all([
        supabase.from("shipments").select("remaining_jb, remaining_sb, total_jb, total_sb"),
        supabase.from("customer_balances").select("bag_type, remaining_qty").eq("status", "pending"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "pending_verification").eq("role", "client"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "verified").eq("role", "client"),
        supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["approved", "partially_approved", "awaiting_check"]),
    ]);

    const totalJB = shipments.data?.reduce((s, r) => s + (r.remaining_jb ?? 0), 0) ?? 0;
    const totalSB = shipments.data?.reduce((s, r) => s + (r.remaining_sb ?? 0), 0) ?? 0;
    const jbBalance = balances.data?.filter(b => b.bag_type === "JB").reduce((s, b) => s + b.remaining_qty, 0) ?? 0;
    const sbBalance = balances.data?.filter(b => b.bag_type === "SB").reduce((s, b) => s + b.remaining_qty, 0) ?? 0;

    return {
        jbGood: totalJB, sbGood: totalSB,
        jbBalance, sbBalance,
        jbNet: totalJB - jbBalance, sbNet: totalSB - sbBalance,
        grandTotal: totalJB + totalSB,
        grandBalance: jbBalance + sbBalance,
        grandNet: (totalJB + totalSB) - (jbBalance + sbBalance),
        pendingOrders: pendingOrders.count ?? 0,
        pendingKyc: pendingKyc.count ?? 0,
        activeClients: activeClients.count ?? 0,
        pendingFulfillment: pendingFulfillment.count ?? 0,
    };
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════

export async function fetchProducts() {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("products").select("*").order("created_at");
    return (data ?? []).filter((product) =>
        product.name?.toLowerCase().includes("portland cement type 1")
        && (product.bag_type === "JB" || product.bag_type === "SB")
    );
}

export async function updateProduct(id: string, updates: {
    name?: string; description?: string; price_per_bag?: number;
    price_port?: number; price_warehouse?: number; is_active?: boolean; image_url?: string;
}) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("products").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "product_updated", "product", id, updates);
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════

export async function fetchOrders(status?: string) {
    const { supabase } = await requireAdmin();
    let query = supabase
        .from("orders")
        .select("*, client:profiles!orders_client_id_fkey(id, full_name, company_name, email, phone), items:order_items(*, product:products(name, bag_type, price_per_bag))")
        .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data } = await query;
    return data ?? [];
}

export async function approveOrder(orderId: string, approvedItems: { itemId: string; qty: number }[], shippingFee?: number) {
    const { supabase, userId } = await requireAdmin();

    // Get order
    const { data: order } = await supabase.from("orders").select("*, items:order_items(*)").eq("id", orderId).single();
    if (!order) throw new Error("Order not found");

    // Update each item's approved_qty
    for (const item of approvedItems) {
        await supabase.from("order_items").update({ approved_qty: item.qty }).eq("id", item.itemId);
    }

    // Check if any item is partially approved
    const isPartial = approvedItems.some(ai => {
        const original = order.items.find((i: { id: string }) => i.id === ai.itemId);
        return original && ai.qty < original.requested_qty;
    });

    // Determine status based on payment method
    let newStatus: string;
    if (order.payment_method === "check") {
        newStatus = "awaiting_check";
    } else if (isPartial) {
        newStatus = "partially_approved";
    } else {
        newStatus = "approved";
    }

    const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
    if (shippingFee !== undefined) updates.shipping_fee = shippingFee;

    await supabase.from("orders").update(updates).eq("id", orderId);

    // Create customer balance records for partial quantities
    if (isPartial) {
        for (const ai of approvedItems) {
            const original = order.items.find((i: { id: string }) => i.id === ai.itemId);
            if (original && ai.qty < original.requested_qty) {
                const remaining = original.requested_qty - ai.qty;
                await supabase.from("customer_balances").insert({
                    client_id: order.client_id,
                    order_id: orderId,
                    product_id: original.product_id,
                    bag_type: original.bag_type,
                    remaining_qty: remaining,
                    status: "pending",
                });
            }
        }
    }

    await logActivity(supabase, userId, "order_approved", "order", orderId, { status: newStatus, approvedItems });
    return { success: true, newStatus };
}

export async function rejectOrder(orderId: string, reason: string) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("orders")
        .update({ status: "rejected", rejection_reason: reason, updated_at: new Date().toISOString() })
        .eq("id", orderId);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "order_rejected", "order", orderId, { reason });
    return { success: true };
}

export async function finalConfirmCheck(orderId: string) {
    const { supabase, userId } = await requireAdmin();
    await supabase.from("orders")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", orderId);
    await logActivity(supabase, userId, "order_check_confirmed", "order", orderId);
    return { success: true };
}

export async function dispatchOrder(
    orderId: string,
    shipmentId: string,
    drNumber: string,
    drImageUrl: string | null,
    driverName: string | null,
    plateNumber: string | null
) {
    const { supabase, userId } = await requireAdmin();

    // Get order with items
    const { data: order } = await supabase.from("orders")
        .select("*, items:order_items(*), client:profiles!orders_client_id_fkey(full_name)")
        .eq("id", orderId).single();
    if (!order) throw new Error("Order not found");

    // Calculate JB and SB quantities
    const jbQty = order.items.filter((i: { bag_type: string }) => i.bag_type === "JB").reduce((s: number, i: { approved_qty: number }) => s + i.approved_qty, 0);
    const sbQty = order.items.filter((i: { bag_type: string }) => i.bag_type === "SB").reduce((s: number, i: { approved_qty: number }) => s + i.approved_qty, 0);

    // Get shipment
    const { data: shipment } = await supabase.from("shipments").select("*").eq("id", shipmentId).single();
    if (!shipment) throw new Error("Shipment batch not found");
    if (shipment.remaining_jb < jbQty || shipment.remaining_sb < sbQty) {
        throw new Error("Insufficient stock in selected batch");
    }

    // Deduct stock
    await supabase.from("shipments").update({
        remaining_jb: shipment.remaining_jb - jbQty,
        remaining_sb: shipment.remaining_sb - sbQty,
        good_stock: shipment.good_stock - (jbQty + sbQty),
    }).eq("id", shipmentId);

    // Create ledger row
    await supabase.from("shipment_ledger").insert({
        shipment_id: shipmentId,
        dr_number: drNumber,
        po_number: order.po_number,
        client_name: order.client?.full_name ?? "Unknown",
        jb: jbQty,
        sb: sbQty,
    });

    // Update order items dispatched_qty
    for (const item of order.items) {
        await supabase.from("order_items").update({ dispatched_qty: item.approved_qty }).eq("id", item.id);
    }

    // Update order status
    await supabase.from("orders").update({
        status: "dispatched",
        tracking_status: "pending_dispatch",
        dr_number: drNumber,
        dr_image_url: drImageUrl,
        driver_name: driverName,
        plate_number: plateNumber,
        shipment_id: shipmentId,
        updated_at: new Date().toISOString(),
    }).eq("id", orderId);

    await logActivity(supabase, userId, "order_dispatched", "order", orderId, {
        shipment: shipment.batch_name, dr: drNumber, jb: jbQty, sb: sbQty,
    });

    return { success: true };
}

export async function updateTrackingStatus(orderId: string, trackingStatus: string, bagsReturnedJb?: number, bagsReturnedSb?: number) {
    const { supabase, userId } = await requireAdmin();
    const updates: Record<string, unknown> = { tracking_status: trackingStatus, updated_at: new Date().toISOString() };
    if (trackingStatus === "bags_returned") {
        if (bagsReturnedJb !== undefined) updates.bags_returned_jb = bagsReturnedJb;
        if (bagsReturnedSb !== undefined) updates.bags_returned_sb = bagsReturnedSb;
    }
    if (trackingStatus === "delivered" || trackingStatus === "bags_returned") {
        updates.status = "completed";
    }
    await supabase.from("orders").update(updates).eq("id", orderId);
    await logActivity(supabase, userId, "tracking_updated", "order", orderId, { trackingStatus });
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// SHIPMENTS
// ═══════════════════════════════════════════════════════════════

export async function fetchShipments() {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("shipments").select("*").order("created_at", { ascending: false });
    return data ?? [];
}

export async function createShipment(batchName: string, totalJb: number, totalSb: number) {
    const { supabase, userId } = await requireAdmin();
    const { data, error } = await supabase.from("shipments").insert({
        batch_name: batchName,
        total_jb: totalJb,
        total_sb: totalSb,
        remaining_jb: totalJb,
        remaining_sb: totalSb,
        initial_quantity: totalJb + totalSb,
        good_stock: totalJb + totalSb,
        damaged_stock: 0,
        arrival_date: new Date().toISOString().split("T")[0],
    }).select().single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "shipment_created", "shipment", data.id, { batchName, totalJb, totalSb });
    return data;
}

export async function fetchShipmentLedger(shipmentId: string) {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("shipment_ledger").select("*").eq("shipment_id", shipmentId).order("date", { ascending: false });
    return data ?? [];
}

export async function addLedgerEntry(shipmentId: string, entry: {
    date?: string; dr_number?: string; po_number?: string; client_name?: string;
    jb?: number; sb?: number; bags_returned?: number; notes?: string;
}) {
    const { supabase, userId } = await requireAdmin();
    const { data, error } = await supabase.from("shipment_ledger").insert({ shipment_id: shipmentId, ...entry }).select().single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "ledger_entry_added", "shipment_ledger", data.id, entry);
    return data;
}

export async function updateLedgerEntry(id: string, updates: Partial<{
    date: string; dr_number: string; po_number: string; client_name: string;
    jb: number; sb: number; bags_returned: number; notes: string;
}>) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("shipment_ledger").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "ledger_entry_updated", "shipment_ledger", id, updates);
    return { success: true };
}

export async function deleteLedgerEntry(id: string) {
    const { supabase, userId } = await requireAdmin();
    await supabase.from("shipment_ledger").delete().eq("id", id);
    await logActivity(supabase, userId, "ledger_entry_deleted", "shipment_ledger", id);
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// PO LIST
// ═══════════════════════════════════════════════════════════════

export async function fetchPurchaseOrders() {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("purchase_orders").select("*").order("date", { ascending: false });
    return data ?? [];
}

export async function createPurchaseOrder(po: {
    po_number: string; client_name?: string; jb?: number; sb?: number;
    status?: string; source?: string; service_type?: string; shipment_id?: string;
}) {
    const { supabase, userId } = await requireAdmin();
    const { data, error } = await supabase.from("purchase_orders").insert(po).select().single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "po_created", "purchase_order", data.id, po);
    return data;
}

export async function updatePurchaseOrder(id: string, updates: Record<string, unknown>) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("purchase_orders").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "po_updated", "purchase_order", id, updates);
    return { success: true };
}

export async function deletePurchaseOrder(id: string) {
    const { supabase, userId } = await requireAdmin();
    await supabase.from("purchase_orders").delete().eq("id", id);
    await logActivity(supabase, userId, "po_deleted", "purchase_order", id);
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// DR LIST
// ═══════════════════════════════════════════════════════════════

export async function fetchDeliveryReceipts() {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("delivery_receipts").select("*, shipment:shipments(batch_name)").order("received_date", { ascending: false });
    return data ?? [];
}

export async function createDeliveryReceipt(dr: {
    shipment_id: string; dr_number: string; quantity?: number; bag_type?: string;
    received_date?: string; po_number?: string; client_name?: string; jb?: number;
    sb?: number; driver?: string; plate_number?: string; shipping_fee?: number;
}) {
    const { supabase, userId } = await requireAdmin();
    const { data, error } = await supabase.from("delivery_receipts").insert({
        ...dr,
        quantity: (dr.jb ?? 0) + (dr.sb ?? 0),
        bag_type: dr.bag_type ?? ((dr.jb ?? 0) > 0 ? "JB" : "SB"),
        received_date: dr.received_date ?? new Date().toISOString().split("T")[0],
    }).select().single();
    if (error) throw new Error(error.message);

    // Auto-insert ledger row into the selected shipment batch
    await supabase.from("shipment_ledger").insert({
        shipment_id: dr.shipment_id,
        dr_number: dr.dr_number,
        po_number: dr.po_number,
        client_name: dr.client_name,
        jb: dr.jb ?? 0,
        sb: dr.sb ?? 0,
    });

    await logActivity(supabase, userId, "dr_created", "delivery_receipt", data.id, dr);
    return data;
}

export async function updateDeliveryReceipt(id: string, updates: Record<string, unknown>) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("delivery_receipts").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "dr_updated", "delivery_receipt", id, updates);
    return { success: true };
}

export async function deleteDeliveryReceipt(id: string) {
    const { supabase, userId } = await requireAdmin();
    await supabase.from("delivery_receipts").delete().eq("id", id);
    await logActivity(supabase, userId, "dr_deleted", "delivery_receipt", id);
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// WAREHOUSE REPORTS
// ═══════════════════════════════════════════════════════════════


export async function fetchWarehouseReport(date: string) {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("warehouse_reports").select("*").eq("report_date", date).maybeSingle();
    return data ?? null;
}

export async function fetchWarehouseReports(limit: number = 30) {
    const { supabase } = await requireAdmin();
    const { data } = await supabase
        .from("warehouse_reports")
        .select("*")
        .order("report_date", { ascending: false })
        .limit(limit);
    return data ?? [];
}

export async function checkReportSubmission(date: string) {
    const { supabase } = await requireAdmin();
    const { data } = await supabase
        .from("activity_log")
        .select("id")
        .eq("action", "warehouse_report_submitted")
        .eq("entity_type", "warehouse_report")
        .filter("metadata->>date", "eq", date)
        .limit(1);
    return (data?.length ?? 0) > 0;
}

export async function saveWarehouseReport(report: {
    report_date: string; yesterday_jb: number; yesterday_sb: number;
    received_jb: number; received_sb: number; dispatched_jb: number; dispatched_sb: number;
    returned_jb: number; returned_sb: number; waste_jb: number; waste_sb: number;
    closing_jb: number; closing_sb: number; notes?: string;
}) {
    const { supabase, userId } = await requireAdmin();
    const { data, error } = await supabase.from("warehouse_reports").upsert(
        { ...report, updated_at: new Date().toISOString() },
        { onConflict: "report_date" }
    ).select().single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "warehouse_report_saved", "warehouse_report", data.id, { date: report.report_date });
    return data;
}

export async function submitWarehouseReport(date: string) {
    const { supabase, userId } = await requireAdmin();
    
    // Ensure report exists first
    const { data: report, error: fetchError } = await supabase
        .from("warehouse_reports")
        .select("id")
        .eq("report_date", date)
        .single();
    
    if (fetchError || !report) throw new Error("Please save the report before submitting.");

    // Log the submission activity
    await logActivity(supabase, userId, "warehouse_report_submitted", "warehouse_report", report.id, { date });
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER BALANCES
// ═══════════════════════════════════════════════════════════════

export async function fetchCustomerBalances() {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("customer_balances")
        .select("*, client:profiles!customer_balances_client_id_fkey(full_name, company_name), product:products!customer_balances_product_id_fkey(name)")
        .eq("status", "pending");
    return data ?? [];
}

export async function updateCustomerBalance(id: string, remaining_qty: number, status: string) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("customer_balances")
        .update({ remaining_qty, status, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "balance_updated", "customer_balances", id, { remaining_qty, status });
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// PROFILES
// ═══════════════════════════════════════════════════════════════

export async function updateProfileRole(profileId: string, role: "client" | "warehouse_manager" | "admin") {
    const { supabase, userId } = await requireAdminOnly();
    const { data: target, error: targetError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", profileId)
        .single();
    if (targetError) throw new Error(targetError.message);
    if (!target || target.role === role) return { success: true };

    const { error } = await supabase
        .from("profiles")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", profileId);
    if (error) throw new Error(error.message);

    await logActivity(supabase, userId, "profile_role_updated", "profile", profileId, {
        from: target.role,
        to: role,
    });
    return { success: true };
}

export async function createManualClient(input: {
    email: string;
    fullName: string;
    password: string;
    phone?: string;
    companyName?: string;
    accountType?: "individual" | "company";
    addressStreet?: string;
    addressCity?: string;
    addressProvince?: string;
    addressPostalCode?: string;
    businessPermitNo?: string;
    tinNo?: string;
}) {
    const { supabase, userId } = await requireAdminOnly();
    const adminClient = createAdminClient();

    const { data, error } = await adminClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
            full_name: input.fullName,
            phone: input.phone ?? null,
            company_name: input.companyName ?? null,
            account_type: input.accountType ?? (input.companyName ? "company" : "individual"),
            address_street: input.addressStreet ?? null,
            address_city: input.addressCity ?? null,
            address_province: input.addressProvince ?? null,
            address_postal_code: input.addressPostalCode ?? null,
            business_permit_no: input.businessPermitNo ?? null,
            tin_no: input.tinNo ?? null,
            role: "client",
            kyc_status: "verified",
        },
    });

    if (error) throw new Error(error.message);
    if (!data.user?.id) throw new Error("Supabase did not return a client id.");

    await logActivity(supabase, userId, "manual_client_created", "profile", data.user.id, {
        email: input.email,
        fullName: input.fullName,
    });

    return { success: true, userId: data.user.id };
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════

export async function getAdminSetting(key: string) {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("admin_settings").select("*").eq("key", key).single();
    return data?.value ?? null;
}

export async function saveAdminSetting(key: string, value: Record<string, unknown>) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("admin_settings").upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
    );
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "setting_updated", "admin_settings", key, { key });
    return { success: true };
}

export async function fetchAuditLog(page: number = 1, perPage: number = 50) {
    const { supabase } = await requireAdmin();
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    const { data, count } = await supabase
        .from("activity_log")
        .select("*, actor:profiles!activity_log_actor_id_fkey(full_name, email)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
    return { entries: data ?? [], total: count ?? 0 };
}


export async function fetchActivityFeed(limit: number = 20) {
    const { supabase } = await requireAdmin();
    const { data } = await supabase
        .from("activity_log")
        .select("*, actor:profiles!activity_log_actor_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(limit);
    return data ?? [];
}

// ═══════════════════════════════════════════════════════════════
// DAILY REPORT AUTO-GENERATION
// ═══════════════════════════════════════════════════════════════

export async function generateDailyReportData(date: string) {
    const { supabase } = await requireAdmin();

    // 1. Yesterday's closing = previous day's warehouse_report closing
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data: prevReport } = await supabase
        .from("warehouse_reports")
        .select("closing_jb, closing_sb")
        .eq("report_date", yesterdayStr)
        .single();

    const yesterday_jb = prevReport?.closing_jb ?? 0;
    const yesterday_sb = prevReport?.closing_sb ?? 0;

    // 2. Received = delivery_receipts created on this date
    const { data: drs } = await supabase
        .from("delivery_receipts")
        .select("jb, sb")
        .eq("received_date", date);

    const received_jb = (drs ?? []).reduce((s, r) => s + (r.jb ?? 0), 0);
    const received_sb = (drs ?? []).reduce((s, r) => s + (r.sb ?? 0), 0);

    // 3. Dispatched = orders updated to dispatched/completed on this date
    const { data: dispatchedOrders } = await supabase
        .from("orders")
        .select("items:order_items(bag_type, dispatched_qty), dr_number, client:profiles!orders_client_id_fkey(full_name, company_name), service_type")
        .in("status", ["dispatched", "completed"])
        .gte("updated_at", `${date}T00:00:00`)
        .lte("updated_at", `${date}T23:59:59`);

    const dispatches = (dispatchedOrders ?? []).map((o: any) => {
        const jb = (o.items ?? []).filter((i: any) => i.bag_type === "JB").reduce((s: number, i: any) => s + (i.dispatched_qty ?? 0), 0);
        const sb = (o.items ?? []).filter((i: any) => i.bag_type === "SB").reduce((s: number, i: any) => s + (i.dispatched_qty ?? 0), 0);
        return {
            client: o.client?.company_name || o.client?.full_name || "Unknown",
            dr: o.dr_number ?? null,
            service: o.service_type ?? "—",
            jb,
            sb,
        };
    });

    const dispatched_jb = dispatches.reduce((s: number, d: any) => s + d.jb, 0);
    const dispatched_sb = dispatches.reduce((s: number, d: any) => s + d.sb, 0);

    // 4. Returned bags = shipment_ledger bags_returned on this date
    const { data: ledgerReturns } = await supabase
        .from("shipment_ledger")
        .select("bags_returned")
        .gte("date", `${date}`)
        .lte("date", `${date}`);

    const returned_total = (ledgerReturns ?? []).reduce((s, r) => s + (r.bags_returned ?? 0), 0);
    // Assume equal split between JB/SB for bag returns unless more granular data exists
    const returned_jb = Math.floor(returned_total / 2);
    const returned_sb = returned_total - returned_jb;

    // 5. Customer obligation balances
    const { data: balances } = await supabase
        .from("customer_balances")
        .select("*, client:profiles!customer_balances_client_id_fkey(full_name, company_name), product:products!customer_balances_product_id_fkey(name)")
        .eq("status", "pending");

    const balanceRows = (balances ?? []).map((b: any) => ({
        client: b.client?.company_name || b.client?.full_name || "Unknown",
        product: b.product?.name || "—",
        qty: b.remaining_qty,
        bag_type: b.bag_type,
    }));

    return {
        yesterday_jb,
        yesterday_sb,
        received_jb,
        received_sb,
        dispatched_jb,
        dispatched_sb,
        returned_jb,
        returned_sb,
        waste_jb: 0,
        waste_sb: 0,
        dispatches,
        balances: balanceRows,
    };
}
