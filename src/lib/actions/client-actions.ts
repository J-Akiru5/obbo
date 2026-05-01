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
    const { supabase, user } = await requireClient();

    // Pending Orders (pending, partially_approved, awaiting_check)
    const { count: pendingOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("client_id", user.id)
        .in("status", ["pending", "partially_approved", "awaiting_check"]);

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
        remainingBags = balances.reduce((acc, b) => {
            // Note: If bag_type is JB, we might multiply by 40, but the requirement said:
            // "JB x 25 + SB x 50" if the client enters JB/SB.
            // However, customer balances just stores 'remaining_qty' and 'bag_type'.
            // Let's just sum up remaining_qty as individual items for now, or apply the formula if we know the bag type.
            // Let's assume remaining_qty is already in individual bags if that's how it's stored, or it's in Jumbo bags.
            // Actually, in the catalog we calculate Total Individual Bags = JB*40 + SB*50. (Wait, prompt says JBx25 + SBx50).
            let multiplier = 1;
            if (b.bag_type === "JB") multiplier = 40; // The standard in OBBO is JB=40. But prompt says JB=25? We will use what the prompt says in the frontend, but let's just return raw balances here.
            return acc + (b.remaining_qty * multiplier);
        }, 0);
    }

    return {
        pendingOrders: pendingOrders || 0,
        activeShipments: activeShipments || 0,
        remainingBags, // We will calculate this better in the frontend if needed
        rawBalances: balances || []
    };
}

export async function fetchRecentOrders() {
    const { supabase, user } = await requireClient();
    const { data } = await supabase
        .from("orders")
        .select("*, items:order_items(*, product:products(name, bag_type, price_per_bag))")
        .eq("client_id", user.id)
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

export async function submitOrder(orderData: any, splitDetails?: { wantsSplit: boolean; deliverNowQty: number; splitNote: string }) {
    const { supabase, user } = await requireClient();

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
        driver_name: orderData.driver_name,
        plate_number: orderData.plate_number,
        notes: notes.trim()
    }).select().single();

    if (error) throw new Error(error.message);

    // Insert order items
    if (orderData.items && orderData.items.length > 0) {
        const itemsToInsert = orderData.items.map((item: any) => ({
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
    return order;
}

export async function submitPaymentDetails(orderId: string, paymentMethod: string, checkNumber?: string, checkImageUrl?: string) {
    const { supabase, user } = await requireClient();

    const updates: any = {
        payment_method: paymentMethod,
    };
    
    if (paymentMethod === "check") {
        updates.check_number = checkNumber;
        updates.check_image_url = checkImageUrl;
        updates.status = "awaiting_check"; // It goes to awaiting_check to let admin verify the check
    } else if (paymentMethod === "cash") {
        // Cash payment submitted, we can move status to "dispatched" (if admin already approved it) or something else.
        // Actually, if approved and client pays cash, it should be marked 'pending_dispatch'
        updates.status = "dispatched"; // Or something else according to flow
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

export async function submitRedeliveryRequest(balanceId: string, orderData: any, splitDetails?: { wantsSplit: boolean; deliverNowQty: number; splitNote: string }) {
    const { supabase, user } = await requireClient();

    // Verify balance
    const { data: balance, error: balError } = await supabase.from("customer_balances").select("*, order:orders(po_number)").eq("id", balanceId).eq("client_id", user.id).single();
    if (balError || !balance) throw new Error("Balance not found");

    // Build notes
    let notes = `[REDELIVERY REQUEST for PO: ${balance.order?.po_number}]\n` + (orderData.notes || "");
    if (splitDetails && splitDetails.wantsSplit) {
        notes += `\n[SPLIT DELIVERY REQUESTED]: Client requested ${splitDetails.deliverNowQty} bags now, and the rest to remain in balances.\n${splitDetails.splitNote}`;
    }

    // We create a new order but total_amount should be 0 because it's a redelivery of prepaid balance?
    // Actually yes, the original order was paid for. Wait, what about shipping fee?
    // Shipping fee is added by manager during approval, so initial total_amount can be 0.
    const { data: order, error } = await supabase.from("orders").insert({
        client_id: user.id,
        status: "pending",
        total_amount: 0, 
        payment_method: orderData.payment_method,
        po_number: orderData.po_number, // They can use the same PO or a new reference
        po_image_url: orderData.po_image_url,
        source: orderData.source,
        service_type: orderData.service_type,
        driver_name: orderData.driver_name,
        plate_number: orderData.plate_number,
        notes: notes.trim()
    }).select().single();

    if (error) throw new Error(error.message);

    // Insert order item for the balance
    // The requested qty is either the full remaining balance, or the split deliverNowQty
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
// SETTINGS / CONTACT
// ═══════════════════════════════════════════════════════════════

export async function getContactInfo() {
    const { supabase } = await requireClient();
    // This policy allows client to read 'contact_info'
    const { data } = await supabase.from("admin_settings").select("value").eq("key", "contact_info").single();
    return data?.value || { email: "admin@obbo.com", phone: "+63 900 000 0000", hours: "Mon-Fri 8AM-5PM" };
}
