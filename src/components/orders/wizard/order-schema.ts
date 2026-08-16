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

// Check payment doesn't require an upfront check image for either service
// type — the client uploads it after approval instead (see
// submitPaymentDetails / the "awaiting_check" order status), once the final
// total (and, for Deliver orders, the shipping fee) is confirmed. This keeps
// Pickup and Deliver + Check consistent — see
// docs/check-payment-flow-implementation-plan.md for why Deliver was fixed
// first; Pickup no longer has the "upload now, discarded, re-upload later"
// gap that plan explicitly left as a known limitation.
export const poPaymentSchema = z.object({
  po_number: z.string().min(1, 'PO number is required'),
  po_file: z.custom<File>().refine((f) => f instanceof File && f.size > 0, 'PO image is required'),
  payment_method: z.enum(['cash', 'check'], 'Please select a payment method'),
  wants_split: z.boolean(),
});

export function getSplitSchema(jbBagsTotal: number, sbBagsTotal: number) {
  return z
    .object({
      wants_split: z.boolean(),
      deliver_now_jb_bags: z.number().min(0),
      deliver_now_sb_bags: z.number().min(0),
    })
    .refine((d) => !d.wants_split || d.deliver_now_jb_bags <= jbBagsTotal, {
      message: 'Cannot exceed ordered JB quantity',
      path: ['deliver_now_jb_bags'],
    })
    .refine((d) => !d.wants_split || d.deliver_now_sb_bags <= sbBagsTotal, {
      message: 'Cannot exceed ordered SB quantity',
      path: ['deliver_now_sb_bags'],
    })
    .refine((d) => !d.wants_split || d.deliver_now_jb_bags + d.deliver_now_sb_bags > 0, {
      message: 'At least one bag must be delivered now',
      path: ['deliver_now_jb_bags'],
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
export const BAG_EQUIVALENT = { JB: 25, SB: 50 } as const;

export function getTotalIndividualBags(jbQty: number, sbQty: number): number {
  return jbQty * BAG_EQUIVALENT.JB + sbQty * BAG_EQUIVALENT.SB;
}

// Convert individual bags -> whole SB/JB units, always rounding UP: a client
// entering 75 individual bags of SB needs 2 SB units (100 actual bags), not
// 1.5. This is purely a client-side input concern — the server always
// receives already-rounded units, so there's no server-twin need here (unlike
// BAG_EQUIVALENT itself, which already has one in profit-utils.ts).
export function bgsToUnits(bags: number, type: 'JB' | 'SB'): number {
  return Math.ceil(bags / BAG_EQUIVALENT[type]);
}

// Convert individual bags -> whole SB/JB units, always rounding DOWN — the
// opposite direction from bgsToUnits. Used wherever a bag count is being
// converted into a unit count that can't exceed what's physically
// available/being fulfilled (approving a request, crediting returned stock):
// rounding up there would approve/credit a unit that isn't actually there.
// Any bag-count remainder below a full unit falls through to whatever
// bag-denominated total tracks "the rest" (e.g. a customer balance).
export function bagsToUnitsFloor(bags: number, type: 'JB' | 'SB'): number {
  return Math.floor(bags / BAG_EQUIVALENT[type]);
}

// Convert SB/JB units -> individual bags (exact, no rounding — the inverse
// of bgsToUnits for whole unit counts).
export function unitsToBags(units: number, type: 'JB' | 'SB'): number {
  return units * BAG_EQUIVALENT[type];
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
