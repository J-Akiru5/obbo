"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Shared utility to generate the next global PO number.
 * Format: PO-YYYY-NNN
 */
export async function generateGlobalNextPoNumber() {
    const supabase = await createClient();
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;

    // Check both tables for the highest number in the current year
    const [{ data: orderData }, { data: poData }] = await Promise.all([
        supabase
            .from("orders")
            .select("po_number")
            .like("po_number", `${prefix}%`)
            .order("po_number", { ascending: false })
            .limit(1),
        supabase
            .from("purchase_orders")
            .select("po_number")
            .like("po_number", `${prefix}%`)
            .order("po_number", { ascending: false })
            .limit(1)
    ]);

    const orderMax = orderData?.[0]?.po_number || "";
    const poMax = poData?.[0]?.po_number || "";

    // Pick the lexically larger one
    const maxPo = orderMax > poMax ? orderMax : poMax;

    if (!maxPo) {
        return `${prefix}001`;
    }

    const parts = maxPo.split("-");
    const lastNumStr = parts[parts.length - 1];
    const lastNum = parseInt(lastNumStr);
    
    // If parsing fails or it's not a number, start at 001
    const nextNum = (isNaN(lastNum) ? 1 : lastNum + 1).toString().padStart(3, "0");
    
    return `${prefix}${nextNum}`;
}
