import { z } from 'zod';
import type { Product } from '@/lib/types/database';

export const productsSchema = z
  .object({
    jb_qty: z.number().min(0),
    sb_qty: z.number().min(0),
  })
  .refine((d) => d.jb_qty + d.sb_qty > 0, {
    message: 'Please order at least 1 JB or SB unit',
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

export function getTotalIndividualBags(jbQty: number, sbQty: number): number {
  return jbQty * 25 + sbQty * 50;
}

export function deriveJBAndSB(totalBags: number): { jb: number; sb: number; remaining: number } {
  const jb = Math.floor(totalBags / 25);
  const remaining = totalBags % 25;
  const sb = Math.floor(remaining / 50);
  const finalRemaining = remaining % 50;
  return { jb, sb, remaining: finalRemaining };
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
  return jbQty * jbPrice + sbQty * sbPrice;
}
