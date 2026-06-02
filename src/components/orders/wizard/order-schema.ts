import { z } from "zod";
import type { Product } from "@/lib/types/database";

export const productsSchema = z
    .object({
        jb_qty: z.number().min(0),
        sb_qty: z.number().min(0),
    })
    .refine((d) => d.jb_qty > 0 || d.sb_qty > 0, {
        message: "At least one quantity must be greater than 0",
    });

export const sourceSchema = z.object({
    source: z.enum(["port", "warehouse"], "Please select a source"),
});

export const serviceTypeSchema = z
    .object({
        service_type: z.enum(["pickup", "deliver"], "Please select a service type"),
        driver_name: z.string().optional(),
        plate_number: z.string().optional(),
        preferred_pickup_date: z.string().optional(),
    })
    .refine(
        (d) =>
            d.service_type !== "pickup" ||
            (d.driver_name && d.driver_name.trim().length > 0),
        { message: "Driver name is required for pick-up", path: ["driver_name"] },
    )
    .refine(
        (d) =>
            d.service_type !== "pickup" ||
            (d.plate_number && d.plate_number.trim().length > 0),
        { message: "Plate number is required for pick-up", path: ["plate_number"] },
    );

export const poPaymentSchema = z
    .object({
        po_number: z.string().min(1, "PO number is required"),
        po_file: z
            .custom<File>()
            .refine((f) => f instanceof File && f.size > 0, "PO image is required"),
        supplier_name: z.string(),
        payment_method: z.enum(["cash", "check"], "Please select a payment method"),
        check_file: z.custom<File>().optional(),
        wants_split: z.boolean(),
        deliver_now_jb: z.number().min(0),
        deliver_now_sb: z.number().min(0),
    })
    .refine(
        (d) =>
            d.payment_method !== "check" ||
            (d.check_file instanceof File && d.check_file.size > 0),
        { message: "Check image is required for check payment", path: ["check_file"] },
    );

export function getSplitSchema(totalJB: number, totalSB: number) {
    return z
        .object({
            wants_split: z.boolean(),
            deliver_now_jb: z.number().min(0),
            deliver_now_sb: z.number().min(0),
        })
        .refine(
            (d) =>
                !d.wants_split ||
                d.deliver_now_jb <= totalJB,
            { message: "Cannot exceed ordered JB quantity", path: ["deliver_now_jb"] },
        )
        .refine(
            (d) =>
                !d.wants_split ||
                d.deliver_now_sb <= totalSB,
            { message: "Cannot exceed ordered SB quantity", path: ["deliver_now_sb"] },
        )
        .refine(
            (d) =>
                !d.wants_split ||
                d.deliver_now_jb + d.deliver_now_sb > 0,
            { message: "At least one deliver-now quantity must be > 0", path: ["deliver_now_jb"] },
        );
}

export type ProductsValues = z.infer<typeof productsSchema>;
export type SourceValues = z.infer<typeof sourceSchema>;
export type ServiceTypeValues = z.infer<typeof serviceTypeSchema>;
export type PoPaymentValues = z.infer<typeof poPaymentSchema>;

export function getPrice(product: Product | undefined, source: string): number {
    if (!product) return 0;
    return source === "port" ? (product.price_port || 0) : (product.price_warehouse || 0);
}

export function getTotalIndividualBags(jbQty: number, sbQty: number): number {
    return jbQty * 25 + sbQty * 50;
}

export function getSubtotal(
    jbQty: number,
    sbQty: number,
    jbPrice: number,
    sbPrice: number,
): number {
    return jbQty * jbPrice + sbQty * sbPrice;
}
