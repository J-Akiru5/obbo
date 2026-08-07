import { z } from 'zod';
import type { Product } from '@/lib/types/database';

export const productsSchema = z
  .object({
    jb_qty: z.number().min(0),
    sb_qty: z.number().min(0),
  })
  .refine((d) => d.jb_qty + d.sb_qty > 0, {
    message: 'Please order at least 1 bag',
    path: ['jb_qty'],
  });

export const sourceSchema = z.object({
  source: z.enum(['port', 'warehouse'], 'Please select a source'),
});

export const serviceTypeSchema = z
  .object({
    service_type: z.enum(['pickup', 'deliver'], 'Please select a service type'),
    driver_name: z.string().optional(),
    plate_number: z.string().optional(),
    preferred_pickup_date: z.string().optional(),
  })
  .refine(
    (d) => d.service_type !== 'pickup' || (d.driver_name && d.driver_name.trim().length > 0),
    { message: 'Driver name is required for pick-up', path: ['driver_name'] },
  )
  .refine(
    (d) => d.service_type !== 'pickup' || (d.plate_number && d.plate_number.trim().length > 0),
    { message: 'Plate number is required for pick-up', path: ['plate_number'] },
  );

export const poPaymentSchema = z
  .object({
    po_number: z.string().min(1, 'PO number is required'),
    po_file: z
      .custom<File>()
      .refine((f) => f instanceof File && f.size > 0, 'PO image is required'),
    payment_method: z.enum(['cash', 'check'], 'Please select a payment method'),
    check_file: z.custom<File>().optional(),
    service_type: z.enum(['pickup', 'deliver']).optional(),
    wants_split: z.boolean(),
    deliver_now_total: z.number().min(0),
  })
  .refine(
    (d) =>
      d.payment_method !== 'check' ||
      d.service_type === 'deliver' ||
      (d.check_file instanceof File && d.check_file.size > 0),
    { message: 'Check image is required for check payment', path: ['check_file'] },
  );

export function getSplitSchema(totalBags: number) {
  return z
    .object({
      wants_split: z.boolean(),
      deliver_now_total: z.number().min(0),
    })
    .refine((d) => !d.wants_split || d.deliver_now_total <= totalBags, {
      message: 'Cannot exceed ordered quantity',
      path: ['deliver_now_total'],
    })
    .refine((d) => !d.wants_split || d.deliver_now_total > 0, {
      message: 'At least one bag must be delivered now',
      path: ['deliver_now_total'],
    });
}

export type ProductsValues = z.infer<typeof productsSchema>;
export type SourceValues = z.infer<typeof sourceSchema>;
export type ServiceTypeValues = z.infer<typeof serviceTypeSchema>;
export type PoPaymentValues = z.infer<typeof poPaymentSchema>;

export function getPrice(product: Product | undefined, source: string): number {
  if (!product) return 0;
  return source === 'port' ? product.price_port || 0 : product.price_warehouse || 0;
}

// 1 Jumbo Bag (JB) = 25 individual 40kg bags. 1 Sling Bag (SB) = 50 individual
// 40kg bags. Prices (price_port/price_warehouse) are per INDIVIDUAL bag, not
// per JB/SB unit — every quantity must be converted before multiplying by
// price. See sales-profit-tracking-module.md, formula #1.
// (Twin copy lives in profit-utils.ts for server actions — keep in sync.)
const BAG_EQUIVALENT = { JB: 25, SB: 50 } as const;

export function getTotalIndividualBags(jbQty: number, sbQty: number): number {
  return jbQty * BAG_EQUIVALENT.JB + sbQty * BAG_EQUIVALENT.SB;
}

export function getSubtotal(totalBags: number, pricePerBag: number): number {
  return totalBags * pricePerBag;
}

export function getSubtotalByBagType(
  jbQty: number,
  sbQty: number,
  jbPrice: number,
  sbPrice: number,
): number {
  return jbQty * BAG_EQUIVALENT.JB * jbPrice + sbQty * BAG_EQUIVALENT.SB * sbPrice;
}

/**
 * Split a "deliver now" amount (individual bags, as entered by the client)
 * into whole JB/SB units, proportional to the order's bag composition.
 *
 * Denominations matter: deliverNowBags is INDIVIDUAL BAGS (same as the
 * wizard's deliver_now_total and the deliver_now_qty column), while the
 * returned deliverNowJB/deliverNowSB are JB/SB UNITS — the denomination of
 * deliver_now_jb/deliver_now_sb, requested_qty, and every approval/dispatch
 * quantity downstream. Splitting is approximate by nature: 25/50-bag units
 * can't always add up to the exact bag count, so the split note tells the
 * warehouse manager exactly what was allocated.
 */
export function getSplitDeliveryUnits(
  jbQty: number,
  sbQty: number,
  deliverNowBags: number,
): { deliverNowJB: number; deliverNowSB: number } {
  const totalBags = getTotalIndividualBags(jbQty, sbQty);
  const target = Math.max(0, Math.min(deliverNowBags, totalBags));
  if (target === 0 || totalBags === 0) return { deliverNowJB: 0, deliverNowSB: 0 };

  // JB's share of the order measured in individual bags, so both sides of
  // the ratio are bags. (The old code divided jbQty UNITS by total BAGS,
  // which is what mixed the denominations.)
  const jbBagShare = (jbQty * BAG_EQUIVALENT.JB) / totalBags;
  const deliverNowJB = Math.min(jbQty, Math.round((target * jbBagShare) / BAG_EQUIVALENT.JB));
  const remainingBags = target - deliverNowJB * BAG_EQUIVALENT.JB;
  const deliverNowSB = Math.min(sbQty, Math.round(remainingBags / BAG_EQUIVALENT.SB));
  return { deliverNowJB, deliverNowSB };
}
