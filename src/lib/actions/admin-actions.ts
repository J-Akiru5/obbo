"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateGlobalNextPoNumber } from "./po-utils";
import { createRoleNotification, createUserNotification } from "./notification-actions";
import type { WarehouseReport, OrderSource, ServiceType, PaymentMethod, OrderStatus, OrderType } from "@/lib/types/database";

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
    return { supabase, userId: user.id, role: profile.role as "admin" | "warehouse_manager" };
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
    name?: string; description?: string; price_per_bag?: number; bag_type?: string;
    price_port?: number; price_warehouse?: number; is_active?: boolean; image_url?: string;
}) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("products").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "product_updated", "product", id, updates);
    return { success: true };
}

export async function createProduct(product: {
    name: string; description: string; bag_type: string; price_per_bag: number;
    price_port: number; price_warehouse: number; is_active: boolean; image_url?: string;
}) {
    const { supabase, userId } = await requireAdmin();
    const { data, error } = await supabase.from("products").insert(product).select().single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "product_created", "product", data.id, product);
    return data;
}

// ═══════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════

export async function fetchOrders(status?: string) {
    const { supabase } = await requireAdmin();
    let query = supabase
        .from("orders")
        .select("*, client:profiles!orders_client_id_fkey(id, full_name, company_name, email, phone, avatar_url), items:order_items(*, product:products(name, bag_type, price_per_bag))")
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
    const requestedOrderQty = order.items.reduce((sum: number, item: { requested_qty: number }) => sum + item.requested_qty, 0);

    const approvedLookup = new Map(approvedItems.map((item: { itemId: string; qty: number }) => [item.itemId, item.qty]));
    let constrainedApprovedItems: { itemId: string; qty: number }[] = order.items.map((item: { id: string; requested_qty: number }) => ({
        itemId: item.id,
        qty: Math.max(0, Math.min(item.requested_qty, approvedLookup.get(item.id) ?? 0)),
    }));

    if (order.is_split_delivery && order.deliver_now_qty > 0) {
        const splitTarget = Math.min(order.deliver_now_qty, requestedOrderQty);
        const totalApprovedQty = constrainedApprovedItems.reduce((sum: number, item: { itemId: string; qty: number }) => sum + item.qty, 0);
        if (totalApprovedQty > splitTarget) {
            let remainingToApprove = splitTarget;
            constrainedApprovedItems = constrainedApprovedItems.map((item: { itemId: string; qty: number }) => {
                const nextQty = Math.max(0, Math.min(item.qty, remainingToApprove));
                remainingToApprove -= nextQty;
                return { ...item, qty: nextQty };
            });
        }
    }

    // Update each item's approved_qty
    for (const item of constrainedApprovedItems) {
        await supabase.from("order_items").update({ approved_qty: item.qty }).eq("id", item.itemId);
    }

    // Check if any item is partially approved
    const isPartial = constrainedApprovedItems.some((ai: { itemId: string; qty: number }) => {
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
        for (const ai of constrainedApprovedItems) {
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

    await logActivity(supabase, userId, "order_approved", "order", orderId, {
        status: newStatus,
        approvedItems,
        splitDeliveryApplied: Boolean(order.is_split_delivery),
    });

    // Notify warehouse manager that order is ready for fulfillment
    const poNumber = order.po_number || orderId.slice(0, 8).toUpperCase();
    await createRoleNotification({
        targetRole: "warehouse_manager",
        title: "Order Ready for Fulfillment",
        message: `PO ${poNumber} has been approved. Review and dispatch from inventory.`,
        href: "/admin/orders?tab=fulfillment",
        severity: "info"
    });

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

    // Check if order was partially approved by looking at items
    const { data: order } = await supabase.from("orders").select("*, items:order_items(*)").eq("id", orderId).single();
    if (!order) throw new Error("Order not found");

    const isPartial = order.items.some((i: any) => i.approved_qty < i.requested_qty);
    const newStatus = isPartial ? "partially_approved" : "approved";

    await supabase.from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);
    
    await logActivity(supabase, userId, "order_check_confirmed", "order", orderId, { status: newStatus });
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

    // Get order with items and full client profile
    const { data: order } = await supabase.from("orders")
        .select("*, items:order_items(*), client:profiles!orders_client_id_fkey(id, full_name, company_name, address_street, address_city, address_province, avatar_url)")
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
    const { error: stockError } = await supabase.from("shipments").update({
        remaining_jb: shipment.remaining_jb - jbQty,
        remaining_sb: shipment.remaining_sb - sbQty,
        good_stock: (shipment.good_stock || 0) - (jbQty + sbQty),
    }).eq("id", shipmentId);
    if (stockError) throw new Error(`Failed to deduct stock: ${stockError.message}`);

    // Create ledger row (with all new fields)
    const clientName = order.client?.company_name || order.client?.full_name || "Unknown Client";
    const destination = [order.client?.address_street, order.client?.address_city, order.client?.address_province].filter(Boolean).join(", ") || null;
    
    const poNumber = order.po_number || `SYS-${orderId.slice(0, 8).toUpperCase()}`;
    const dispatchDate = new Date().toISOString().split("T")[0];

    const { error: ledgerError } = await supabase.from("shipment_ledger").insert({
        shipment_id: shipmentId,
        dr_number: drNumber,
        po_number: poNumber,
        client_name: clientName,
        driver_name: driverName,
        plate_number: plateNumber,
        destination,
        service_type: order.service_type,
        jb: jbQty,
        sb: sbQty,
        payment_method: order.payment_method,
        check_number: order.payment_method === "check" ? order.check_number : null,
        amount: Number(order.total_amount) || null,
    });
    if (ledgerError) throw new Error(`Failed to create ledger entry: ${ledgerError.message}`);

    // Handle Split Delivery: Create customer balance for remaining quantities
    for (const item of order.items) {
        if ((item.approved_qty || 0) < (item.requested_qty || 0)) {
            const remaining = item.requested_qty - item.approved_qty;
            
            // Check if a balance already exists for this item in this order (idempotency)
            const { data: existing } = await supabase
                .from("customer_balances")
                .select("id")
                .eq("order_id", orderId)
                .eq("product_id", item.product_id)
                .eq("bag_type", item.bag_type)
                .single();

            if (!existing) {
                const { error: balanceError } = await supabase.from("customer_balances").insert({
                    client_id: order.client_id,
                    order_id: orderId,
                    product_id: item.product_id,
                    bag_type: item.bag_type,
                    total_purchase: item.requested_qty,
                    remaining_qty: remaining,
                    status: "pending",
                });
                if (balanceError) console.error("Balance creation error:", balanceError);
            }
        }
    }

    // If this is a redelivery order, deduct dispatched qty from original customer balance
    if (order.order_type === "redelivery" && order.linked_po_number) {
        const { data: originalOrder } = await supabase.from("orders")
            .select("id").eq("po_number", order.linked_po_number).maybeSingle();

        if (originalOrder) {
            for (const item of order.items) {
                const dispatchedQty = item.approved_qty || 0;
                if (dispatchedQty <= 0) continue;

                const { data: balance } = await supabase.from("customer_balances")
                    .select("id, remaining_qty")
                    .eq("order_id", originalOrder.id)
                    .eq("product_id", item.product_id)
                    .eq("bag_type", item.bag_type)
                    .eq("status", "pending")
                    .maybeSingle();

                if (balance && balance.remaining_qty > 0) {
                    const newRemaining = balance.remaining_qty - dispatchedQty;
                    const newStatus = newRemaining <= 0 ? "fulfilled" : "pending";
                    const { error: balanceUpdateError } = await supabase.from("customer_balances").update({
                        remaining_qty: Math.max(0, newRemaining),
                        status: newStatus,
                    }).eq("id", balance.id);
                    if (balanceUpdateError) {
                        console.error("Balance deduction on redelivery dispatch failed:", balanceUpdateError);
                    }
                }
            }
        }
    }

    revalidatePath("/client/ledger");

    // Update order items dispatched_qty
    for (const item of order.items) {
        const { error: itemError } = await supabase.from("order_items").update({ dispatched_qty: item.approved_qty }).eq("id", item.id);
        if (itemError) console.error(`Failed to update item ${item.id}:`, itemError);
    }

    // Update order status
    const { error: orderUpdateError } = await supabase.from("orders").update({
        status: "dispatched",
        tracking_status: "pending_dispatch",
        dr_number: drNumber,
        dr_image_url: drImageUrl,
        driver_name: driverName,
        plate_number: plateNumber,
        shipment_id: shipmentId,
        updated_at: new Date().toISOString(),
    }).eq("id", orderId);
    if (orderUpdateError) throw new Error(`Failed to update order status: ${orderUpdateError.message}`);

    // ── AUTO-GENERATE PO RECORD ──────────────────────────────
    // Determine payment columns
    let checkNumber: string | null = null;
    let checkAmount: number | null = null;
    let cashAmount: number | null = null;
    
    if (order.payment_method === "check") {
        checkNumber = order.check_number || null;
        checkAmount = Number(order.total_amount) || null;
    } else if (order.payment_method === "cash") {
        cashAmount = Number(order.total_amount) || null;
    } else {
        cashAmount = Number(order.total_amount) || null;
    }

    const poPayload = {
        po_number: poNumber,
        client_id: order.client_id,
        client_name: clientName,
        jb: jbQty,
        sb: sbQty,
        date: dispatchDate,
        status: "dispatched",
        source: order.source,
        service_type: order.service_type,
        shipment_id: shipmentId,
        order_id: orderId,
        check_number: checkNumber,
        check_amount: checkAmount,
        cash_amount: cashAmount,
        photo_url: order.po_image_url,
        updated_at: new Date().toISOString(),
    };

    // Check if a PO record with this po_number already exists
    const { data: existingPo } = await supabase.from("purchase_orders")
        .select("id").eq("po_number", poNumber).maybeSingle();

    let poResult;
    if (existingPo) {
        poResult = await supabase.from("purchase_orders").update(poPayload).eq("id", existingPo.id);
    } else {
        poResult = await supabase.from("purchase_orders").insert(poPayload);
    }

    if (poResult?.error) {
        console.error("PO Auto-generation error:", poResult.error);
        // Non-blocking: let dispatch complete even if PO sync fails
    }

    // ── AUTO-GENERATE DR RECORD ──────────────────────────────
    const { data: drRecord, error: drError } = await supabase.from("delivery_receipts").upsert({
        dr_number: drNumber,
        shipment_id: shipmentId,
        client_name: clientName,
        client_id: order.client_id,
        po_number: poNumber,
        jb: jbQty,
        sb: sbQty,
        quantity: jbQty + sbQty,
        bag_type: jbQty > 0 ? "JB" : "SB",
        received_date: dispatchDate,
        driver: driverName,
        plate_number: plateNumber,
        shipping_fee: Number(order.shipping_fee) || 0,
        dr_image_url: drImageUrl,
        destination: destination,
        order_id: orderId,
    }, { onConflict: "dr_number" }).select().single();

    if (drError) throw new Error(`Failed to auto-generate DR record: ${drError.message}`);

    // Link the ledger entry to the DR via FK
    if (drRecord?.id) {
        await supabase.from("shipment_ledger")
            .update({ delivery_receipt_id: drRecord.id })
            .eq("dr_number", drNumber)
            .eq("shipment_id", shipmentId);
    }

    await logActivity(supabase, userId, "order_dispatched", "order", orderId, {
        shipment: shipment.batch_name, dr: drNumber, jb: jbQty, sb: sbQty,
    });

    return { success: true };
}

export async function updateTrackingStatus(orderId: string, trackingStatus: string, bagsReturnedJb?: number, bagsReturnedSb?: number, returnReason?: string) {
    const { supabase, userId } = await requireAdmin();
    const updates: Record<string, unknown> = { tracking_status: trackingStatus, updated_at: new Date().toISOString() };
    
    const isReturn = trackingStatus === "bags_returned" || trackingStatus === "returned_good" || trackingStatus === "returned_waste";
    
    if (isReturn) {
        if (bagsReturnedJb !== undefined) updates.bags_returned_jb = (updates.bags_returned_jb as number || 0) + bagsReturnedJb;
        if (bagsReturnedSb !== undefined) updates.bags_returned_sb = (updates.bags_returned_sb as number || 0) + bagsReturnedSb;
    }
    if (trackingStatus === "delivered" || isReturn) {
        updates.status = "completed";
    }
    await supabase.from("orders").update(updates).eq("id", orderId);
    await logActivity(supabase, userId, "tracking_updated", "order", orderId, { trackingStatus });

    // If bags were returned, auto-create a shipment ledger entry so it reflects in stock and reports
    if (isReturn && (bagsReturnedJb || bagsReturnedSb)) {
        const { data: order } = await supabase.from("orders").select("shipment_id, po_number, dr_number, client_id").eq("id", orderId).single();
        if (order?.shipment_id) {
            let clientLabel = "Unknown";
            if (order.client_id) {
                const { data: profile } = await supabase.from("profiles").select("full_name, company_name").eq("id", order.client_id).single();
                clientLabel = profile?.company_name || profile?.full_name || "Unknown";
            }
            // Determine return_reason based on status
            const reason = trackingStatus === "returned_waste" ? "waste" : "return";
            const { data: drRecord } = await supabase.from("delivery_receipts")
                .select("id").eq("dr_number", order.dr_number).maybeSingle();
            await addLedgerEntry(order.shipment_id, {
                date: new Date().toISOString().split("T")[0],
                po_number: order.po_number,
                dr_number: order.dr_number,
                client_name: clientLabel,
                jb: 0,
                sb: 0,
                bags_returned: (bagsReturnedJb || 0) + (bagsReturnedSb || 0),
                bag_returned_type: bagsReturnedJb ? "JB" : "SB",
                return_reason: reason,
                client_reason: returnReason || undefined,
                delivery_receipt_id: drRecord?.id || null,
            });
        }
    }

    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// SHIPMENTS
// ═══════════════════════════════════════════════════════════════

export async function fetchShipments() {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("shipments").select("*").order("created_at", { ascending: false }).limit(10000);
    return data ?? [];
}

export async function createShipment(batchName: string, totalJb: number, totalSb: number, arrivalDate?: string, damagedJb: number = 0, damagedSb: number = 0) {
    const { supabase, userId } = await requireAdmin();
    const totalBags = totalJb + totalSb;
    const goodJb = totalJb - damagedJb;
    const goodSb = totalSb - damagedSb;
    
    const { data, error } = await supabase.from("shipments").insert({
        batch_name: batchName,
        total_jb: totalJb,
        total_sb: totalSb,
        remaining_jb: goodJb,
        remaining_sb: goodSb,
        initial_quantity: totalBags,
        good_stock: goodJb + goodSb,
        damaged_stock: damagedJb + damagedSb,
        damaged_jb: damagedJb,
        damaged_sb: damagedSb,
        arrival_date: arrivalDate ?? new Date().toISOString().split("T")[0],
    }).select().single();
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "shipment_created", "shipment", data.id, { batchName, totalJb, totalSb, damagedJb, damagedSb });

    // Notify warehouse manager about new shipment
    await createRoleNotification({
        targetRole: "warehouse_manager",
        title: "New Shipment Arrived",
        message: `Batch "${batchName}" with ${totalJb} JB / ${totalSb} SB bags has been recorded.`,
        href: "/admin/inventory?tab=shipments",
        severity: "info"
    });

    return data;
}

export async function updateShipment(id: string, updates: Partial<{
    batch_name: string;
    total_jb: number;
    total_sb: number;
    remaining_jb: number;
    remaining_sb: number;
    good_stock: number;
    arrival_date: string;
}>) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("shipments").update({ 
        ...updates, 
        // Keep good_stock in sync if remaining counts are manually set
        ...(updates.remaining_jb !== undefined || updates.remaining_sb !== undefined ? {
            good_stock: (updates.remaining_jb ?? 0) + (updates.remaining_sb ?? 0),
        } : {}),
    }).eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "shipment_updated", "shipment", id, updates);
    return { success: true };
}

export async function fetchShipmentLedger(shipmentId: string) {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("shipment_ledger").select("*").eq("shipment_id", shipmentId).order("date", { ascending: false });
    return data ?? [];
}

export async function addLedgerEntry(shipmentId: string, entry: {
    date?: string;
    po_number?: string;
    dr_number?: string;
    client_name?: string;
    driver_name?: string;
    plate_number?: string;
    destination?: string;
    service_type?: string;
    jb?: number;
    sb?: number;
    payment_method?: string;
    check_number?: string;
    amount?: number;
    bags_returned?: number;
    bag_returned_type?: string;
    return_reason?: string;
    client_reason?: string;
    notes?: string;
    delivery_receipt_id?: string | null;
}) {
    const { supabase, userId } = await requireAdmin();
    const jbOut = entry.jb ?? 0;
    const sbOut = entry.sb ?? 0;
    const returned = entry.bags_returned ?? 0;
    const returnedType = entry.bag_returned_type ?? null;
    const returnReason = entry.return_reason ?? "return";

    // Insert the ledger row
    const { data, error } = await supabase.from("shipment_ledger").insert({
        shipment_id: shipmentId,
        ...entry,
        date: entry.date ?? new Date().toISOString().split("T")[0],
    }).select().single();
    if (error) throw new Error(error.message);

    // Adjust shipment remaining stock
    // Only 'return' reason adds bags back to stock; 'waste'/'damage' are write-offs
    const { data: shipment } = await supabase.from("shipments").select("remaining_jb, remaining_sb, good_stock").eq("id", shipmentId).single();
    if (shipment) {
        const restockReturned = returnReason === "return" && returned > 0;
        const jbReturned = restockReturned && returnedType === "JB" ? returned : 0;
        const sbReturned = restockReturned && returnedType === "SB" ? returned : 0;
        const newRemainingJb = Math.max(0, (shipment.remaining_jb ?? 0) - jbOut + jbReturned);
        const newRemainingSb = Math.max(0, (shipment.remaining_sb ?? 0) - sbOut + sbReturned);
        await supabase.from("shipments").update({
            remaining_jb: newRemainingJb,
            remaining_sb: newRemainingSb,
            good_stock: newRemainingJb + newRemainingSb,
        }).eq("id", shipmentId);
    }

    await logActivity(supabase, userId, "ledger_entry_added", "shipment_ledger", data.id, entry);
    return data;
}

export async function updateLedgerEntry(
    id: string,
    shipmentId: string,
    oldEntry: { jb: number; sb: number; bags_returned: number; bag_returned_type: string | null; return_reason: string | null },
    updates: Partial<{
        date: string; po_number: string; dr_number: string; client_name: string;
        driver_name: string; plate_number: string; destination: string; service_type: string;
        jb: number; sb: number; payment_method: string; check_number: string; amount: number;
        bags_returned: number; bag_returned_type: string; return_reason: string; notes: string;
    }>
) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("shipment_ledger").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);

    // Recalculate stock delta: reverse old, apply new
    // Only 'return' reason affects stock; 'waste'/'damage' are write-offs
    const wasRestockable = oldEntry.return_reason === "return" || !oldEntry.return_reason;
    const newReturnReason = updates.return_reason ?? oldEntry.return_reason ?? "return";
    const isRestockable = newReturnReason === "return";

    const { data: shipment } = await supabase.from("shipments").select("remaining_jb, remaining_sb").eq("id", shipmentId).single();
    if (shipment) {
        const oldJbReturned = wasRestockable && oldEntry.bags_returned > 0 && oldEntry.bag_returned_type === "JB" ? oldEntry.bags_returned : 0;
        const oldSbReturned = wasRestockable && oldEntry.bags_returned > 0 && oldEntry.bag_returned_type === "SB" ? oldEntry.bags_returned : 0;
        const newJbOut = updates.jb ?? oldEntry.jb;
        const newSbOut = updates.sb ?? oldEntry.sb;
        const newReturned = updates.bags_returned ?? oldEntry.bags_returned;
        const newReturnedType = updates.bag_returned_type ?? oldEntry.bag_returned_type;
        const newJbReturned = isRestockable && newReturned > 0 && newReturnedType === "JB" ? newReturned : 0;
        const newSbReturned = isRestockable && newReturned > 0 && newReturnedType === "SB" ? newReturned : 0;

        // Reverse old effect, apply new effect
        const correctedJb = (shipment.remaining_jb ?? 0)
            + oldEntry.jb - oldJbReturned   // undo old
            - newJbOut + newJbReturned;       // apply new
        const correctedSb = (shipment.remaining_sb ?? 0)
            + oldEntry.sb - oldSbReturned
            - newSbOut + newSbReturned;

        await supabase.from("shipments").update({
            remaining_jb: Math.max(0, correctedJb),
            remaining_sb: Math.max(0, correctedSb),
            good_stock: Math.max(0, correctedJb) + Math.max(0, correctedSb),
        }).eq("id", shipmentId);
    }

    await logActivity(supabase, userId, "ledger_entry_updated", "shipment_ledger", id, updates);
    return { success: true };
}

// ─── Helper: create order record for client portal from manual PO/DR ──
async function createOrderForClientPortal(
    supabase: Awaited<ReturnType<typeof createClient>>,
    params: {
        clientId: string;
        poNumber: string;
        jbQty: number;
        sbQty: number;
        source: OrderSource;
        serviceType: ServiceType;
        checkNumber: string | null;
        checkAmount: number | null;
        cashAmount: number | null;
        photoUrl: string | null;
        status: OrderStatus;
        drNumber?: string | null;
        drImageUrl?: string | null;
        driverName?: string | null;
        plateNumber?: string | null;
        shipmentId?: string | null;
        shippingFee?: number;
    }
) {
    const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .in("bag_type", ["JB", "SB"]);

    const jbProduct = products?.find(p => p.bag_type === "JB");
    const sbProduct = products?.find(p => p.bag_type === "SB");

    const paymentMethod: PaymentMethod =
        params.checkNumber && params.checkAmount && params.checkAmount > 0 ? "check" : "cash";

    let totalAmount = (params.checkAmount || 0) + (params.cashAmount || 0);
    if (totalAmount === 0 && params.jbQty + params.sbQty > 0) {
        const jbPrice = params.source === "port"
            ? (jbProduct?.price_port || jbProduct?.price_per_bag || 0)
            : (jbProduct?.price_warehouse || jbProduct?.price_per_bag || 0);
        const sbPrice = params.source === "port"
            ? (sbProduct?.price_port || sbProduct?.price_per_bag || 0)
            : (sbProduct?.price_warehouse || sbProduct?.price_per_bag || 0);
        totalAmount = (params.jbQty * jbPrice) + (params.sbQty * sbPrice);
    }

    const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
            client_id: params.clientId,
            status: params.status,
            total_amount: totalAmount,
            payment_method: paymentMethod,
            po_number: params.poNumber,
            po_image_url: params.photoUrl,
            source: params.source,
            service_type: params.serviceType,
            check_number: params.checkNumber || null,
            dr_number: params.drNumber || null,
            dr_image_url: params.drImageUrl || null,
            driver_name: params.driverName || null,
            plate_number: params.plateNumber || null,
            shipment_id: params.shipmentId || null,
            shipping_fee: params.shippingFee || 0,
            tracking_status: params.status === "dispatched" ? "pending_dispatch" : "pending_dispatch",
            order_type: "new",
        })
        .select()
        .single();

    if (orderError || !orderData) {
        throw new Error(orderError?.message || "Failed to create order");
    }

    const isDispatched = params.status === "dispatched";
    const orderItems: any[] = [];
    if (params.jbQty > 0 && jbProduct) {
        orderItems.push({
            order_id: orderData.id,
            product_id: jbProduct.id,
            bag_type: "JB",
            requested_qty: params.jbQty,
            approved_qty: params.jbQty,
            dispatched_qty: isDispatched ? params.jbQty : 0,
        });
    }
    if (params.sbQty > 0 && sbProduct) {
        orderItems.push({
            order_id: orderData.id,
            product_id: sbProduct.id,
            bag_type: "SB",
            requested_qty: params.sbQty,
            approved_qty: params.sbQty,
            dispatched_qty: isDispatched ? params.sbQty : 0,
        });
    }
    if (orderItems.length > 0) {
        await supabase.from("order_items").insert(orderItems);
    }

    return orderData;
}

// ═══════════════════════════════════════════════════════════════
// PO LIST
// ═══════════════════════════════════════════════════════════════

export async function fetchPurchaseOrders() {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("purchase_orders").select("*, order:orders(id, status, po_number, dr_number)").order("date", { ascending: false }).limit(10000);
    return data ?? [];
}

export async function generateAdminPoNumber() {
    return generateGlobalNextPoNumber();
}

export async function createPurchaseOrder(po: {
    po_number?: string; client_name?: string; client_id?: string | null; jb?: number; sb?: number;
    quantity?: number; bag_type?: string;
    status?: string; source?: string; service_type?: string; shipment_id?: string;
    check_number?: string | null; check_amount?: number | null; cash_amount?: number | null;
    photo_url?: string;
}) {
    const { supabase, userId } = await requireAdmin();
    
    // Auto-generate if blank
    let finalPoNumber = po.po_number?.trim();
    if (!finalPoNumber) {
        finalPoNumber = await generateGlobalNextPoNumber();
    }

    // Map quantity and bag_type to legacy jb/sb columns
    const jb = po.jb ?? (po.bag_type === "JB" ? (po.quantity ?? 0) : 0);
    const sb = po.sb ?? (po.bag_type === "SB" ? (po.quantity ?? 0) : 0);

    const { data, error } = await supabase.from("purchase_orders").insert({
        ...po,
        jb,
        sb,
        po_number: finalPoNumber
    }).select().single();
    if (error) throw new Error(error.message);

    // If a verified client is selected, auto-create an order so it reflects in the client portal
    if (data.client_id) {
        try {
            const orderData = await createOrderForClientPortal(supabase, {
                clientId: data.client_id,
                poNumber: finalPoNumber,
                jbQty: jb,
                sbQty: sb,
                source: (po.source || "warehouse") as OrderSource,
                serviceType: (po.service_type || "pickup") as ServiceType,
                checkNumber: po.check_number ?? null,
                checkAmount: po.check_amount ?? null,
                cashAmount: po.cash_amount ?? null,
                photoUrl: po.photo_url ?? null,
                status: "approved",
            });

            await supabase.from("purchase_orders")
                .update({ order_id: orderData.id })
                .eq("id", data.id);
            data.order_id = orderData.id;

            await createUserNotification({
                userId: data.client_id,
                title: "Order Created",
                message: `Order PO-${finalPoNumber} (${jb} JB / ${sb} SB) has been created for your account by the warehouse.`,
                href: "/client/orders",
                severity: "success",
            });

            revalidatePath("/client/orders");
            revalidatePath("/client/dashboard");
        } catch (e) {
            console.error("Failed to create client portal order from manual PO:", e);
        }
    }

    await logActivity(supabase, userId, "po_created", "purchase_order", data.id, po);
    return data;
}

export async function updatePurchaseOrder(id: string, updates: any) {
    const { supabase, userId } = await requireAdmin();
    
    // Handle unified quantity mapping if provided
    if (updates.quantity !== undefined && updates.bag_type !== undefined) {
        updates.jb = updates.bag_type === "JB" ? updates.quantity : 0;
        updates.sb = updates.bag_type === "SB" ? updates.quantity : 0;
        // Don't delete them if they exist in DB, but usually they don't for PO
    }

    const { error } = await supabase.from("purchase_orders").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "po_updated", "purchase_order", id, updates);
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// DR LIST
// ═══════════════════════════════════════════════════════════════

export async function fetchDeliveryReceipts() {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("delivery_receipts").select("*, shipment:shipments(batch_name), order:orders(id, status, po_number, dr_number)").order("received_date", { ascending: false }).limit(10000);
    return data ?? [];
}

export async function createDeliveryReceipt(dr: {
    shipment_id: string; dr_number: string; quantity?: number; bag_type?: string;
    received_date?: string; po_number?: string; client_name?: string; client_id?: string | null;
    jb?: number; sb?: number; driver?: string; plate_number?: string; shipping_fee?: number;
    destination?: string; dr_image_url?: string;
}) {
    const { supabase, userId } = await requireAdmin();

    // 1. Fetch linked PO data to unify ledger row
    let poData = null;
    if (dr.po_number) {
        const { data: po } = await supabase.from("purchase_orders").select("*").eq("po_number", dr.po_number).single();
        if (po) poData = po;
    }

    const clientName = dr.client_name || poData?.client_name || "Unknown";
    const effectiveClientId = dr.client_id || poData?.client_id || null;

    // Map quantity and bag_type to legacy jb/sb columns
    const jb = dr.jb ?? (dr.bag_type === "JB" ? (dr.quantity ?? 0) : 0);
    const sb = dr.sb ?? (dr.bag_type === "SB" ? (dr.quantity ?? 0) : 0);

    // 2. Create the DR record
    const { data, error } = await supabase.from("delivery_receipts").insert({
        ...dr,
        client_name: clientName,
        client_id: effectiveClientId,
        jb,
        sb,
        quantity: dr.quantity ?? jb + sb,
        bag_type: dr.bag_type ?? (jb > 0 ? "JB" : "SB"),
        received_date: dr.received_date ?? new Date().toISOString().split("T")[0],
    }).select().single();
    if (error) throw new Error(error.message);

    // 3. Auto-insert UNIFIED ledger row via addLedgerEntry (handles stock deduction)
    await addLedgerEntry(dr.shipment_id, {
        dr_number: dr.dr_number,
        po_number: dr.po_number,
        date: dr.received_date,
        client_name: clientName,
        destination: dr.destination,
        service_type: poData?.service_type || "pickup",
        jb,
        sb,
        driver_name: dr.driver,
        plate_number: dr.plate_number,
        payment_method: poData?.check_number ? "check" : (poData?.cash_amount ? "cash" : undefined),
        check_number: poData?.check_number,
        amount: poData ? (Number(poData.check_amount) || Number(poData.cash_amount) || undefined) : undefined,
        delivery_receipt_id: data.id,
    });

    // 4. If linked PO has a verified client, sync with client portal
    if (effectiveClientId) {
        try {
            if (poData?.order_id) {
                // Update existing order (created during manual PO step)
                await supabase.from("orders").update({
                    status: "dispatched",
                    tracking_status: "pending_dispatch",
                    dr_number: dr.dr_number,
                    dr_image_url: dr.dr_image_url || null,
                    driver_name: dr.driver || null,
                    plate_number: dr.plate_number || null,
                    shipment_id: dr.shipment_id,
                    shipping_fee: dr.shipping_fee || 0,
                    updated_at: new Date().toISOString(),
                }).eq("id", poData.order_id);

                // Update dispatched_qty on order items
                const { data: orderItems } = await supabase
                    .from("order_items")
                    .select("id, bag_type")
                    .eq("order_id", poData.order_id);
                if (orderItems) {
                    for (const item of orderItems) {
                        const dispatchedQty = item.bag_type === "JB" ? jb : sb;
                        if (dispatchedQty > 0) {
                            await supabase.from("order_items")
                                .update({ dispatched_qty: dispatchedQty })
                                .eq("id", item.id);
                        }
                    }
                }

                await supabase.from("delivery_receipts")
                    .update({ order_id: poData.order_id })
                    .eq("id", data.id);
                data.order_id = poData.order_id;

                await createUserNotification({
                    userId: effectiveClientId,
                    title: "Order Dispatched",
                    message: `Your order PO-${dr.po_number} has been dispatched. DR: ${dr.dr_number}.`,
                    href: "/client/orders",
                    severity: "success",
                });
            } else {
                // No existing order - create one with dispatched status
                const orderData = await createOrderForClientPortal(supabase, {
                    clientId: effectiveClientId,
                    poNumber: poData?.po_number || dr.po_number || "",
                    jbQty: jb,
                    sbQty: sb,
                    source: (poData?.source || "warehouse") as OrderSource,
                    serviceType: (poData?.service_type || "pickup") as ServiceType,
                    checkNumber: poData?.check_number || null,
                    checkAmount: poData?.check_amount || null,
                    cashAmount: poData?.cash_amount || null,
                    photoUrl: poData?.photo_url || null,
                    status: "dispatched",
                    drNumber: dr.dr_number,
                    drImageUrl: dr.dr_image_url || null,
                    driverName: dr.driver || null,
                    plateNumber: dr.plate_number || null,
                    shipmentId: dr.shipment_id,
                    shippingFee: dr.shipping_fee || 0,
                });

                // Link PO to order
                if (poData?.id) {
                    await supabase.from("purchase_orders")
                        .update({ order_id: orderData.id })
                        .eq("id", poData.id);
                }
                await supabase.from("delivery_receipts")
                    .update({ order_id: orderData.id })
                    .eq("id", data.id);
                data.order_id = orderData.id;

                await createUserNotification({
                    userId: effectiveClientId,
                    title: "Order Created & Dispatched",
                    message: `Order PO-${dr.po_number} (DR: ${dr.dr_number}) has been created and dispatched for your account by the warehouse.`,
                    href: "/client/orders",
                    severity: "success",
                });
            }

            revalidatePath("/client/orders");
            revalidatePath("/client/dashboard");
        } catch (e) {
            console.error("Failed to sync client portal order from manual DR:", e);
        }
    }

    await logActivity(supabase, userId, "dr_created", "delivery_receipt", data.id, dr);
    return data;
}

export async function updateDeliveryReceipt(id: string, updates: any) {
    const { supabase, userId } = await requireAdmin();

    // Fetch existing DR for old values
    const { data: oldDr } = await supabase.from("delivery_receipts").select("*").eq("id", id).single();
    if (!oldDr) throw new Error("Delivery receipt not found");

    // Handle unified quantity mapping if provided
    if (updates.quantity !== undefined && updates.bag_type !== undefined) {
        updates.jb = updates.bag_type === "JB" ? updates.quantity : 0;
        updates.sb = updates.bag_type === "SB" ? updates.quantity : 0;
    }

    const newJb = updates.jb ?? oldDr.jb;
    const newSb = updates.sb ?? oldDr.sb;
    const newDrNumber = updates.dr_number ?? oldDr.dr_number;
    const newShipmentId = updates.shipment_id ?? oldDr.shipment_id;

    // Update the DR record
    const { error } = await supabase.from("delivery_receipts").update(updates).eq("id", id);
    if (error) throw new Error(error.message);

    // Sync with ledger entry if quantities changed or key fields changed
    if (updates.jb !== undefined || updates.sb !== undefined || updates.dr_number !== undefined ||
        updates.client_name !== undefined || updates.driver !== undefined || updates.plate_number !== undefined) {

        // Find the corresponding ledger entry: prefer FK, fall back to dr_number + shipment_id
        let { data: ledgerEntry } = await supabase
            .from("shipment_ledger")
            .select("*")
            .eq("delivery_receipt_id", id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!ledgerEntry && oldDr.dr_number) {
            const { data: fallback } = await supabase
                .from("shipment_ledger")
                .select("*")
                .eq("dr_number", oldDr.dr_number)
                .eq("shipment_id", oldDr.shipment_id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            ledgerEntry = fallback;
            // Backfill the FK for future lookups
            if (fallback) {
                await supabase.from("shipment_ledger")
                    .update({ delivery_receipt_id: id })
                    .eq("id", fallback.id);
            }
        }

        if (ledgerEntry) {
            // Reverse old stock deduction, apply new deduction
            const { data: shipment } = await supabase
                .from("shipments")
                .select("remaining_jb, remaining_sb")
                .eq("id", oldDr.shipment_id)
                .single();

            if (shipment) {
                const correctedJb = Math.max(0, (shipment.remaining_jb ?? 0)
                    + (oldDr.jb || 0)   // undo old deduction
                    - newJb);            // apply new deduction
                const correctedSb = Math.max(0, (shipment.remaining_sb ?? 0)
                    + (oldDr.sb || 0)
                    - newSb);

                await supabase.from("shipments").update({
                    remaining_jb: correctedJb,
                    remaining_sb: correctedSb,
                    good_stock: correctedJb + correctedSb,
                }).eq("id", oldDr.shipment_id);
            }

            // If shipment changed, also need to deduct from new shipment
            if (updates.shipment_id && updates.shipment_id !== oldDr.shipment_id) {
                const { data: newShipment } = await supabase
                    .from("shipments")
                    .select("remaining_jb, remaining_sb")
                    .eq("id", newShipmentId)
                    .single();
                if (newShipment) {
                    const newRemJb = Math.max(0, (newShipment.remaining_jb ?? 0) - newJb);
                    const newRemSb = Math.max(0, (newShipment.remaining_sb ?? 0) - newSb);
                    await supabase.from("shipments").update({
                        remaining_jb: newRemJb,
                        remaining_sb: newRemSb,
                        good_stock: newRemJb + newRemSb,
                    }).eq("id", newShipmentId);
                }
            }

            // Update the ledger entry
            await supabase.from("shipment_ledger").update({
                dr_number: newDrNumber,
                shipment_id: newShipmentId,
                jb: newJb,
                sb: newSb,
                client_name: updates.client_name ?? ledgerEntry.client_name,
                driver_name: updates.driver ?? ledgerEntry.driver_name,
                plate_number: updates.plate_number ?? ledgerEntry.plate_number,
                date: updates.received_date ?? ledgerEntry.date,
                updated_at: new Date().toISOString(),
            }).eq("id", ledgerEntry.id);
        } else if (updates.jb !== undefined || updates.sb !== undefined) {
            // No existing ledger entry found but quantities changed — create one
            await addLedgerEntry(newShipmentId, {
                dr_number: newDrNumber,
                client_name: updates.client_name ?? oldDr.client_name ?? "Unknown",
                jb: newJb,
                sb: newSb,
                driver_name: updates.driver ?? oldDr.driver,
                plate_number: updates.plate_number ?? oldDr.plate_number,
                date: updates.received_date ?? oldDr.received_date,
                delivery_receipt_id: id,
            });
        }
    }

    await logActivity(supabase, userId, "dr_updated", "delivery_receipt", id, updates);
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// WAREHOUSE REPORTS
// ═══════════════════════════════════════════════════════════════

export async function generateDailyReportData(date: string) {
    const { supabase } = await requireAdmin();

    // 1. Get yesterday's closing stock
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split("T")[0];
    
    const { data: yesterdayReport } = await supabase.from("warehouse_reports").select("closing_jb, closing_sb").eq("report_date", prevDateStr).maybeSingle();
    const yesterday_jb = yesterdayReport?.closing_jb || 0;
    const yesterday_sb = yesterdayReport?.closing_sb || 0;

    // 2. Get today's received stock from shipments (including damaged)
    const { data: shipments } = await supabase.from("shipments").select("total_jb, total_sb, damaged_jb, damaged_sb").eq("arrival_date", date);
    const received_jb = shipments?.reduce((sum, s) => sum + (s.total_jb || 0), 0) || 0;
    const received_sb = shipments?.reduce((sum, s) => sum + (s.total_sb || 0), 0) || 0;
    const shipmentDamagedJb = shipments?.reduce((sum, s) => sum + (s.damaged_jb || 0), 0) || 0;
    const shipmentDamagedSb = shipments?.reduce((sum, s) => sum + (s.damaged_sb || 0), 0) || 0;

    // 3. Get today's dispatches & returns from ledger
    const { data: ledger } = await supabase.from("shipment_ledger").select("*").eq("date", date);
    const dispatched_jb = ledger?.reduce((sum, l) => sum + (l.jb || 0), 0) || 0;
    const dispatched_sb = ledger?.reduce((sum, l) => sum + (l.sb || 0), 0) || 0;
    
    let returned_jb = 0;
    let returned_sb = 0;
    let waste_jb = 0;
    let waste_sb = 0;
    ledger?.forEach(l => {
        const isWaste = l.return_reason === "waste" || l.return_reason === "damage";
        if (l.bags_returned && l.bag_returned_type === "JB") {
            if (isWaste) waste_jb += l.bags_returned;
            else returned_jb += l.bags_returned;
        }
        if (l.bags_returned && l.bag_returned_type === "SB") {
            if (isWaste) waste_sb += l.bags_returned;
            else returned_sb += l.bags_returned;
        }
    });

    // Add damaged bags from shipment intake to waste totals (arrival-day damage)
    waste_jb += shipmentDamagedJb;
    waste_sb += shipmentDamagedSb;

    // 4. Get today's dispatches for Module 2 from orders
    const { data: orders } = await supabase
        .from("orders")
        .select("*, client:profiles!orders_client_id_fkey(full_name, company_name), items:order_items(*)")
        .in("status", ["dispatched", "completed"])
        .gte("updated_at", `${date}T00:00:00.000Z`)
        .lt("updated_at", `${date}T23:59:59.999Z`);
        
    const dispatches = (orders || []).map(o => {
        const jb = o.items?.filter((i: any) => i.bag_type === "JB").reduce((s: number, i: any) => s + i.dispatched_qty, 0) || 0;
        const sb = o.items?.filter((i: any) => i.bag_type === "SB").reduce((s: number, i: any) => s + i.dispatched_qty, 0) || 0;
        return {
            client: o.client?.company_name || o.client?.full_name,
            dr: o.dr_number,
            service: o.service_type,
            jb, sb,
        };
    });

    // 4b. Also include DRs from delivery_receipts not already covered by orders
    const drNumbersInOrders = new Set(orders?.map(o => o.dr_number).filter(Boolean) || []);
    const { data: drs } = await supabase
        .from("delivery_receipts")
        .select("*")
        .eq("received_date", date);
    for (const dr of (drs || [])) {
        if (!dr.dr_number || drNumbersInOrders.has(dr.dr_number)) continue;
        dispatches.push({
            client: dr.client_name || "Walk-in",
            dr: dr.dr_number,
            service: dr.jb > 0 ? "JB" : "SB",
            jb: dr.jb || 0,
            sb: dr.sb || 0,
        });
    }

    // 5. Get pending balances for Module 3
    const { data: customerBalances } = await supabase
        .from("customer_balances")
        .select("*, client:profiles!customer_balances_client_id_fkey(full_name, company_name), product:products!customer_balances_product_id_fkey(name), order:orders(po_number)")
        .eq("status", "pending");
        
    const balances = (customerBalances || []).map(b => ({
        client: b.client?.company_name || b.client?.full_name,
        product: b.product?.name,
        qty: b.remaining_qty,
        bag_type: b.bag_type,
    }));

    return {
        yesterday_jb, yesterday_sb,
        received_jb, received_sb,
        dispatched_jb, dispatched_sb,
        returned_jb, returned_sb,
        waste_jb, waste_sb,
        dispatches,
        balances
    };
}

export async function fetchWarehouseReport(date: string) {
    const { supabase, role } = await requireAdmin();
    const { data } = await supabase.from("warehouse_reports").select("*").eq("report_date", date).maybeSingle();
    if (!data) return null;

    const today = new Date().toISOString().split("T")[0];
    // Admin can only see today's report if it has been submitted
    if (role === "admin" && date === today && !data.submitted) {
        return null;
    }
    return data as unknown as WarehouseReport;
}

export async function fetchWarehouseReports(limit: number = 30) {
    const { supabase, role } = await requireAdmin();
    const today = new Date().toISOString().split("T")[0];
    let query = supabase
        .from("warehouse_reports")
        .select("*")
        .order("report_date", { ascending: false })
        .limit(limit);
    if (role === "admin") {
        // Admin sees past reports always, but today's only if submitted
        query = query.or(`report_date.lt.${today},and(report_date.eq.${today},submitted.eq.true)`);
    }
    const { data } = await query;
    return (data ?? []) as unknown as WarehouseReport[];
}

export async function checkReportSubmission(date: string) {
    const { supabase } = await requireAdmin();
    const { data } = await supabase
        .from("warehouse_reports")
        .select("submitted")
        .eq("report_date", date)
        .maybeSingle();
    return data?.submitted ?? false;
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

    // Mark report as submitted
    await supabase.from("warehouse_reports").update({ submitted: true }).eq("id", report.id);

    // Log the submission activity
    await logActivity(supabase, userId, "warehouse_report_submitted", "warehouse_report", report.id, { date });

    // Trigger Admin Notification
    await createRoleNotification({
        targetRole: "admin",
        title: "Daily Report Submitted",
        message: `Warehouse report for ${date} has been submitted for review.`,
        href: "/admin/inventory?tab=reports",
        severity: "info"
    });

    return { success: true };
}

export async function autoSubmitEndOfDayReports() {
    const { supabase, userId, role } = await requireAdmin();
    if (role !== "warehouse_manager" && role !== "admin") throw new Error("Forbidden");

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const autoSubmitted: string[] = [];

    // Find any unsubmitted reports from past days
    const { data: pastReports } = await supabase
        .from("warehouse_reports")
        .select("*")
        .lt("report_date", today)
        .eq("submitted", false);

    for (const report of pastReports ?? []) {
        await supabase.from("warehouse_reports").update({ submitted: true }).eq("id", report.id);
        await logActivity(supabase, userId, "warehouse_report_auto_submitted", "warehouse_report", report.id, { date: report.report_date });
        autoSubmitted.push(report.report_date);
    }

    // Also check if yesterday has no report at all — auto-generate and submit
    const { data: yesterdayReport } = await supabase
        .from("warehouse_reports")
        .select("id")
        .eq("report_date", yesterday)
        .maybeSingle();

    if (!yesterdayReport) {
        try {
            const generated = await generateDailyReportData(yesterday);
            const closing_jb = generated.yesterday_jb + generated.received_jb - generated.dispatched_jb + generated.returned_jb - generated.waste_jb;
            const closing_sb = generated.yesterday_sb + generated.received_sb - generated.dispatched_sb + generated.returned_sb - generated.waste_sb;
            const { data: newReport } = await supabase.from("warehouse_reports").upsert({
                report_date: yesterday,
                yesterday_jb: generated.yesterday_jb, yesterday_sb: generated.yesterday_sb,
                received_jb: generated.received_jb, received_sb: generated.received_sb,
                dispatched_jb: generated.dispatched_jb, dispatched_sb: generated.dispatched_sb,
                returned_jb: generated.returned_jb, returned_sb: generated.returned_sb,
                waste_jb: generated.waste_jb, waste_sb: generated.waste_sb,
                closing_jb, closing_sb,
                submitted: true,
            }).select().single();
            if (newReport) {
                await logActivity(supabase, userId, "warehouse_report_auto_submitted", "warehouse_report", newReport.id, { date: yesterday });
                autoSubmitted.push(yesterday);
            }
        } catch (e) {
            console.error("Auto-generate failed for", yesterday, e);
        }
    }

    return { autoSubmitted };
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMER BALANCES
// ═══════════════════════════════════════════════════════════════

export async function fetchCustomerBalances() {
    const { supabase } = await requireAdmin();
    const { data } = await supabase.from("customer_balances")
        .select("*, client:profiles!customer_balances_client_id_fkey(full_name, company_name), product:products!customer_balances_product_id_fkey(name), order:orders(po_number)")
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
// KYC VERIFICATION
// ═══════════════════════════════════════════════════════════════

export async function fetchPendingKyc() {
        const { supabase } = await requireAdmin();
        const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("kyc_status", "pending_verification")
            .eq("role", "client")
            .order("created_at", { ascending: true });
        return data ?? [];
    }

    export async function fetchVerifiedClients() {
        const { supabase } = await requireAdmin();
        const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("kyc_status", "verified")
            .eq("role", "client")
            .order("created_at", { ascending: false });
        return data ?? [];
    }

    export async function approveKyc(profileId: string) {
        const { supabase, userId } = await requireAdmin();

        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", profileId)
            .single();

        const { error } = await supabase
            .from("profiles")
            .update({ kyc_status: "verified", updated_at: new Date().toISOString() })
            .eq("id", profileId);

        if (error) throw new Error(error.message);

        await logActivity(supabase, userId, "kyc_approved", "profile", profileId, {
            status: "verified",
        });

        // Notify client about KYC approval
        await createUserNotification({
            userId: profileId,
            title: "KYC Approved",
            message: "Your account has been verified. You can now place orders and access all portal features.",
            href: "/client/dashboard",
            severity: "success"
        });

        return { success: true };
    }

    export async function rejectKyc(profileId: string, reason: string) {
        const { supabase, userId } = await requireAdmin();

        const { error } = await supabase
            .from("profiles")
            .update({
                kyc_status: "rejected",
                updated_at: new Date().toISOString(),
            })
            .eq("id", profileId);

        if (error) throw new Error(error.message);

        await logActivity(supabase, userId, "kyc_rejected", "profile", profileId, {
            reason,
            status: "rejected",
        });

        // Notify client about KYC rejection
        await createUserNotification({
            userId: profileId,
            title: "KYC Rejected",
            message: `Your verification was not approved. Reason: ${reason}. Please contact support or re-submit your documents.`,
            href: "/client/profile",
            severity: "warning"
        });

        return { success: true };
    }

// ═══════════════════════════════════════════════════════════════
// ORDER RETURNS
// ═══════════════════════════════════════════════════════════════

export async function fetchOrderReturns() {
    const { supabase } = await requireAdmin();
    const { data } = await supabase
        .from("order_returns")
        .select("*, order:orders(po_number, dr_number, client:profiles!orders_client_id_fkey(full_name, company_name))")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    return data ?? [];
}

export async function processOrderReturn(returnId: string) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase.from("order_returns").update({ status: "processed", updated_at: new Date().toISOString() }).eq("id", returnId);
    if (error) throw new Error(error.message);
    await logActivity(supabase, userId, "return_processed", "order_returns", returnId, {});
    return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

export async function fetchAdminNotifications() {
    const { supabase, userId } = await requireAdmin();
    const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
    return data ?? [];
}

export async function fetchUnreadAdminNotificationCount() {
    const { supabase, userId } = await requireAdmin();
    const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
    return count ?? 0;
}

export async function markAdminNotificationRead(notificationId: string) {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function markAllAdminNotificationsRead() {
    const { supabase, userId } = await requireAdmin();
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
    if (error) throw new Error(error.message);
    return { success: true };
}

