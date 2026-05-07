"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Helper to ensure the user is an authenticated client
async function requireClient() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (!profile || profile.role !== "client") {
        throw new Error("Unauthorized: Client access only");
    }

    return { supabase, user, profile };
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

export async function fetchClientDashboardKPIs() {
    const { supabase, user, profile } = await requireClient();

    // Pending Orders (pending, partially_approved, awaiting_check)
    const { count: pendingOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("client_id", user.id)
        .in("status", ["pending", "partially_approved", "awaiting_check"])
        .neq("order_type", "draft");

    // Active Shipments (dispatched, in_transit)
    const { count: activeShipments } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("client_id", user.id)
        .in("tracking_status", ["pending_dispatch", "in_transit"])
        .in("status", ["dispatched", "approved"]);

    // Remaining Balance
    const { data: balances } = await supabase
        .from("customer_balances")
        .select("remaining_qty, bag_type")
        .eq("client_id", user.id)
        .eq("status", "pending");

    let remainingBags = 0;
    if (balances) {
        remainingBags = balances.reduce((acc, b) => acc + b.remaining_qty, 0);
    }

    return {
        pendingOrders: pendingOrders || 0,
        activeShipments: activeShipments || 0,
        remainingBags,
        rawBalances: balances || [],
        clientName: profile.company_name || profile.full_name || "Client",
    };
}

export async function fetchRecentOrders() {
    const { supabase, user } = await requireClient();
    const { data } = await supabase
        .from("orders")
        .select("*, items:order_items(*, product:products(name, bag_type, price_per_bag))")
        .eq("client_id", user.id)
        .neq("order_type", "draft")
        .order("created_at", { ascending: false })
        .limit(5);
    return data ?? [];
}

export async function fetchClientOrders() {
    const { supabase, user } = await requireClient();
    const { data } = await supabase
        .from("orders")
        .select("*, items:order_items(*, product:products(name, bag_type, price_per_bag))")
        .eq("client_id", user.id)
        .neq("order_type", "draft")
        .order("created_at", { ascending: false });
    return data ?? [];
}

// ═══════════════════════════════════════════════════════════════
// CATALOG & ORDERS
// ═══════════════════════════════════════════════════════════════

export async function fetchActiveProducts() {
    const { supabase } = await requireClient();
    const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
    return data ?? [];
}

export async function submitOrder(
    orderData: {
        source: string;
        service_type: string;
        payment_method: string;
        po_number: string;
        po_image_url: string;
        supplier_name?: string;
        driver_name?: string | null;
        plate_number?: string | null;
        total_amount: number;
        items: { product_id: string; bag_type: string; requested_qty: number }[];
        notes?: string;
        preferred_pickup_date?: string;
    },
    splitDetails?: { wantsSplit: boolean; deliverNowQty: number; splitNote: string }
) {
    const { supabase, user } = await requireClient();
    if (!orderData.po_number?.trim()) throw new Error("PO number is required.");
    if (!orderData.po_image_url?.trim()) throw new Error("PO image is required.");
    if (orderData.service_type === "pickup") {
        if (!orderData.driver_name?.trim()) throw new Error("Driver name is required for pick-up orders.");
        if (!orderData.plate_number?.trim()) throw new Error("Plate number is required for pick-up orders.");
    }

    // Build notes
    let notes = orderData.notes || "";
    if (splitDetails && splitDetails.wantsSplit) {
        notes += `\n[SPLIT DELIVERY REQUESTED]: Client requested ${splitDetails.deliverNowQty} bags now, and the rest to be saved to balances.\n${splitDetails.splitNote}`;
    }

    const { data: order, error } = await supabase.from("orders").insert({
        client_id: user.id,
        status: "pending",
        total_amount: orderData.total_amount,
        payment_method: orderData.payment_method,
        po_number: orderData.po_number,
        po_image_url: orderData.po_image_url,
        source: orderData.source,
        service_type: orderData.service_type,
        supplier_name: orderData.supplier_name || null,
        driver_name: orderData.driver_name,
        plate_number: orderData.plate_number,
        preferred_pickup_date: orderData.preferred_pickup_date || null,
        is_split_delivery: splitDetails?.wantsSplit ?? false,
        deliver_now_qty: splitDetails?.deliverNowQty ?? 0,
        order_type: "new",
        notes: notes.trim()
    }).select().single();

    if (error) throw new Error(error.message);

    // Insert order items
    if (orderData.items && orderData.items.length > 0) {
        const itemsToInsert = orderData.items.map((item) => ({
            order_id: order.id,
            product_id: item.product_id,
            bag_type: item.bag_type,
            requested_qty: item.requested_qty,
            approved_qty: 0,
            dispatched_qty: 0
        }));
        await supabase.from("order_items").insert(itemsToInsert);
    }

    revalidatePath("/client/orders");
    revalidatePath("/client/dashboard");
    return order;
}

export async function saveOrderDraft(
    orderData: {
        source: string;
        service_type: string;
        payment_method: string;
        po_number: string;
        po_image_url?: string;
        supplier_name?: string;
        driver_name?: string | null;
        plate_number?: string | null;
        total_amount: number;
        items: { product_id: string; bag_type: string; requested_qty: number }[];
        notes?: string;
        preferred_pickup_date?: string;
    },
    splitDetails?: { wantsSplit: boolean; deliverNowQty: number }
) {
    const { supabase, user } = await requireClient();

    const { data: order, error } = await supabase.from("orders").insert({
        client_id: user.id,
        status: "pending",
        total_amount: orderData.total_amount,
        payment_method: orderData.payment_method,
        po_number: orderData.po_number || "DRAFT",
        po_image_url: orderData.po_image_url || null,
        source: orderData.source,
        service_type: orderData.service_type,
        supplier_name: orderData.supplier_name || null,
        driver_name: orderData.driver_name,
        plate_number: orderData.plate_number,
        preferred_pickup_date: orderData.preferred_pickup_date || null,
        is_split_delivery: splitDetails?.wantsSplit ?? false,
        deliver_now_qty: splitDetails?.deliverNowQty ?? 0,
        order_type: "draft",
        notes: orderData.notes || ""
    }).select().single();

    if (error) throw new Error(error.message);

    // Insert order items
    if (orderData.items && orderData.items.length > 0) {
        const itemsToInsert = orderData.items.map((item) => ({
            order_id: order.id,
            product_id: item.product_id,
            bag_type: item.bag_type,
            requested_qty: item.requested_qty,
            approved_qty: 0,
            dispatched_qty: 0
        }));
        await supabase.from("order_items").insert(itemsToInsert);
    }

    revalidatePath("/client/catalog");
    return order;
}

export async function fetchDraftOrders() {
    const { supabase, user } = await requireClient();
    const { data } = await supabase
        .from("orders")
        .select("*, items:order_items(*, product:products(name, bag_type, price_per_bag))")
        .eq("client_id", user.id)
        .eq("order_type", "draft")
        .order("created_at", { ascending: false });
    return data ?? [];
}

export async function deleteDraftOrder(orderId: string) {
    const { supabase, user } = await requireClient();
    // Delete items first, then order
    await supabase.from("order_items").delete().eq("order_id", orderId);
    const { error } = await supabase.from("orders").delete().eq("id", orderId).eq("client_id", user.id).eq("order_type", "draft");
    if (error) throw new Error(error.message);
    revalidatePath("/client/catalog");
    return { success: true };
}

export async function submitPaymentDetails(orderId: string, paymentMethod: string, checkNumber?: string, checkImageUrl?: string) {
    const { supabase, user } = await requireClient();

    const updates: Record<string, unknown> = {
        payment_method: paymentMethod,
        updated_at: new Date().toISOString(),
    };
    
    if (paymentMethod === "check") {
        updates.check_number = checkNumber;
        updates.check_image_url = checkImageUrl;
        updates.status = "awaiting_check"; // It goes to awaiting_check to let admin verify the check
    } else if (paymentMethod === "cash") {
        // Cash payment submitted — mark as awaiting dispatch
        updates.status = "dispatched";
    }

    const { error } = await supabase.from("orders").update(updates).eq("id", orderId).eq("client_id", user.id);
    if (error) throw new Error(error.message);

    revalidatePath("/client/orders");
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// LEDGER / BALANCES
// ═══════════════════════════════════════════════════════════════

export async function fetchClientBalances() {
    const { supabase, user } = await requireClient();
    const { data } = await supabase
        .from("customer_balances")
        .select("*, product:products(name, price_per_bag, bag_type), order:orders(po_number)")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });
    return data ?? [];
}

export async function fetchBalanceSummary() {
    const { supabase, user } = await requireClient();

    // Total purchased: sum of all requested_qty from all completed/dispatched orders
    const { data: orders } = await supabase
        .from("orders")
        .select("items:order_items(requested_qty)")
        .eq("client_id", user.id)
        .neq("order_type", "draft")
        .in("status", ["approved", "partially_approved", "dispatched", "completed", "awaiting_check"]);

    let totalPurchased = 0;
    if (orders) {
        for (const order of orders) {
            const items = order.items as { requested_qty: number }[];
            totalPurchased += items.reduce((acc, item) => acc + item.requested_qty, 0);
        }
    }

    // Total delivered: sum of all dispatched_qty from all orders
    const { data: dispatchedOrders } = await supabase
        .from("orders")
        .select("items:order_items(dispatched_qty)")
        .eq("client_id", user.id)
        .neq("order_type", "draft")
        .in("status", ["dispatched", "completed"]);

    let totalDelivered = 0;
    if (dispatchedOrders) {
        for (const order of dispatchedOrders) {
            const items = order.items as { dispatched_qty: number }[];
            totalDelivered += items.reduce((acc, item) => acc + item.dispatched_qty, 0);
        }
    }

    // Remaining balance from customer_balances
    const { data: balances } = await supabase
        .from("customer_balances")
        .select("remaining_qty")
        .eq("client_id", user.id)
        .eq("status", "pending");

    const remainingBalance = balances?.reduce((acc, b) => acc + b.remaining_qty, 0) ?? 0;

    return { totalPurchased, totalDelivered, remainingBalance };
}

export async function submitRedeliveryRequest(balanceId: string, orderData: {
    source: string;
    service_type: string;
    payment_method: string;
    po_number: string;
    po_image_url: string;
    driver_name?: string | null;
    plate_number?: string | null;
    notes?: string;
    preferred_pickup_date?: string;
}, splitDetails?: { wantsSplit: boolean; deliverNowQty: number; splitNote: string }) {
    const { supabase, user } = await requireClient();

    // Verify balance
    const { data: balance, error: balError } = await supabase.from("customer_balances").select("*, order:orders(po_number)").eq("id", balanceId).eq("client_id", user.id).single();
    if (balError || !balance) throw new Error("Balance not found");

    const linkedPo = balance.order?.po_number || "";
    const effectivePoNumber = linkedPo || orderData.po_number?.trim() || "";
    if (!effectivePoNumber) throw new Error("PO number is required for re-delivery.");
    if (!orderData.po_image_url?.trim()) throw new Error("PO image is required for re-delivery.");
    if (orderData.service_type === "pickup") {
        if (!orderData.driver_name?.trim()) throw new Error("Driver name is required for pick-up orders.");
        if (!orderData.plate_number?.trim()) throw new Error("Plate number is required for pick-up orders.");
    }

    // Build notes
    let notes = `[REDELIVERY REQUEST for PO: ${linkedPo}]\n` + (orderData.notes || "");
    if (splitDetails && splitDetails.wantsSplit) {
        notes += `\n[SPLIT DELIVERY REQUESTED]: Client requested ${splitDetails.deliverNowQty} bags now, and the rest to remain in balances.\n${splitDetails.splitNote}`;
    }

    // Create a new order linked to the original PO
    const { data: order, error } = await supabase.from("orders").insert({
        client_id: user.id,
        status: "pending",
        total_amount: 0, // Re-delivery: bags already paid, only shipping fee (set by admin)
        payment_method: orderData.payment_method,
        po_number: effectivePoNumber,
        po_image_url: orderData.po_image_url,
        source: orderData.source,
        service_type: orderData.service_type,
        driver_name: orderData.driver_name,
        plate_number: orderData.plate_number,
        preferred_pickup_date: orderData.preferred_pickup_date || null,
        is_split_delivery: splitDetails?.wantsSplit ?? false,
        deliver_now_qty: splitDetails?.deliverNowQty ?? 0,
        order_type: "redelivery",
        linked_po_number: linkedPo,
        notes: notes.trim()
    }).select().single();

    if (error) throw new Error(error.message);

    // Insert order item for the balance
    const requestedQty = splitDetails?.wantsSplit ? splitDetails.deliverNowQty : balance.remaining_qty;

    await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: balance.product_id,
        bag_type: balance.bag_type,
        requested_qty: requestedQty,
        approved_qty: 0,
        dispatched_qty: 0
    });

    // Update customer balance to deduct the requested amount, or mark as fulfilled if full
    const newRemaining = balance.remaining_qty - requestedQty;
    const newStatus = newRemaining <= 0 ? "fulfilled" : "pending";
    await supabase.from("customer_balances").update({
        remaining_qty: Math.max(0, newRemaining),
        status: newStatus
    }).eq("id", balance.id);

    revalidatePath("/client/ledger");
    revalidatePath("/client/orders");
    return order;
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

export async function fetchClientNotifications() {
    const { supabase, user } = await requireClient();
    const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
    return data ?? [];
}

export async function fetchUnreadNotificationCount() {
    const { supabase, user } = await requireClient();
    const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
    const { supabase, user } = await requireClient();
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/client/dashboard");
    return { success: true };
}

export async function markAllNotificationsRead() {
    const { supabase, user } = await requireClient();
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    if (error) throw new Error(error.message);
    revalidatePath("/client/dashboard");
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// PROFILE & SETTINGS
// ═══════════════════════════════════════════════════════════════

export async function fetchClientProfile() {
    const { supabase, user } = await requireClient();
    const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
    return { profile: data, email: user.email };
}

export async function updateNotificationPreferences(prefs: {
    order_approval: boolean;
    payment_required: boolean;
    dispatch: boolean;
    delivery_status: boolean;
}) {
    const { supabase, user } = await requireClient();
    const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: prefs, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/client/profile");
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS / CONTACT
// ═══════════════════════════════════════════════════════════════

export async function getContactInfo() {
    const { supabase } = await requireClient();
    // This policy allows client to read 'contact_info'
    const { data } = await supabase.from("admin_settings").select("value").eq("key", "contact_info").single();
    return data?.value || { email: "admin@obbo.com", phone: "+63 900 000 0000", hours: "Mon-Fri 8AM-5PM" };
}
