import { z } from 'zod';

// ─── Purchase Order ─────────────────────────────────────────────
export const purchaseOrderUpdateSchema = z.object({
  po_number: z.string().trim().min(1).optional(),
  client_name: z.string().trim().min(1).optional(),
  client_id: z.string().uuid().nullable().optional(),
  jb: z.number().int().min(0).optional(),
  sb: z.number().int().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  bag_type: z.enum(['JB', 'SB']).optional(),
  status: z.string().trim().min(1).optional(),
  source: z.enum(['port', 'warehouse']).optional(),
  service_type: z.enum(['pickup', 'deliver']).optional(),
  shipment_id: z.string().uuid().optional(),
  check_number: z.string().trim().nullable().optional(),
  check_amount: z.number().min(0).nullable().optional(),
  cash_amount: z.number().min(0).nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  date: z.string().optional(),
});

// ─── Delivery Receipt ───────────────────────────────────────────
export const deliveryReceiptCreateSchema = z
  .object({
    shipment_id: z.string().uuid(),
    dr_number: z.string().trim().min(1),
    quantity: z.number().int().min(0).optional(),
    bag_type: z.enum(['JB', 'SB']).optional(),
    received_date: z.string().optional(),
    po_number: z.string().trim().optional(),
    client_name: z.string().trim().optional(),
    client_id: z.string().uuid().nullable().optional(),
    jb: z.number().int().min(0).optional(),
    sb: z.number().int().min(0).optional(),
    driver: z.string().trim().optional(),
    plate_number: z.string().trim().optional(),
    shipping_fee: z.number().min(0).optional(),
    destination: z.string().trim().optional(),
    dr_image_url: z.string().url().optional(),
  })
  .strict();

export const deliveryReceiptUpdateSchema = z.object({
  dr_number: z.string().trim().min(1).optional(),
  shipment_id: z.string().uuid().optional(),
  client_name: z.string().trim().optional(),
  client_id: z.string().uuid().nullable().optional(),
  po_number: z.string().trim().optional(),
  jb: z.number().int().min(0).optional(),
  sb: z.number().int().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  bag_type: z.enum(['JB', 'SB']).optional(),
  received_date: z.string().optional(),
  driver: z.string().trim().nullable().optional(),
  plate_number: z.string().trim().nullable().optional(),
  shipping_fee: z.number().min(0).optional(),
  destination: z.string().trim().nullable().optional(),
  dr_image_url: z.string().url().nullable().optional(),
  order_id: z.string().uuid().nullable().optional(),
});

// ─── Order ──────────────────────────────────────────────────────
export const orderApproveSchema = z.object({
  orderId: z.string().uuid(),
  approvedItems: z.array(
    z.object({
      itemId: z.string().uuid(),
      qty: z.number().int().min(0),
    }),
  ),
  shippingFee: z.number().min(0).optional(),
});

export const orderRejectSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(1),
});

export const orderTrackingUpdateSchema = z.object({
  orderId: z.string().uuid(),
  trackingStatus: z.enum([
    'pending_dispatch',
    'in_transit',
    'delivered',
    'bags_returned',
    'returned_good',
    'returned_waste',
  ]),
  bagsReturnedJb: z.number().int().min(0).optional(),
  bagsReturnedSb: z.number().int().min(0).optional(),
  returnReason: z.string().nullable().optional(),
});

// ─── Shipment ───────────────────────────────────────────────────
export const shipmentCreateSchema = z.object({
  batchName: z.string().trim().min(1),
  totalJb: z.number().int().min(0),
  totalSb: z.number().int().min(0),
  arrivalDate: z.string().optional(),
  damagedJb: z.number().int().min(0).default(0),
  damagedSb: z.number().int().min(0).default(0),
});

export const shipmentUpdateSchema = z.object({
  batch_name: z.string().trim().min(1).optional(),
  total_jb: z.number().int().min(0).optional(),
  total_sb: z.number().int().min(0).optional(),
  remaining_jb: z.number().int().min(0).optional(),
  remaining_sb: z.number().int().min(0).optional(),
  good_stock: z.number().int().min(0).optional(),
  arrival_date: z.string().optional(),
});

// ─── Ledger Entry ───────────────────────────────────────────────
export const ledgerEntryCreateSchema = z.object({
  date: z.string().optional(),
  po_number: z.string().trim().optional(),
  dr_number: z.string().trim().optional(),
  client_name: z.string().trim().optional(),
  driver_name: z.string().trim().nullable().optional(),
  plate_number: z.string().trim().nullable().optional(),
  destination: z.string().trim().nullable().optional(),
  service_type: z.enum(['pickup', 'deliver']).optional(),
  jb: z.number().int().min(0).optional(),
  sb: z.number().int().min(0).optional(),
  payment_method: z.enum(['cash', 'check']).optional(),
  check_number: z.string().nullable().optional(),
  amount: z.number().min(0).nullable().optional(),
  bags_returned: z.number().int().min(0).optional(),
  bag_returned_type: z.enum(['JB', 'SB']).nullable().optional(),
  return_reason: z.string().optional(),
  client_reason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  delivery_receipt_id: z.string().uuid().nullable().optional(),
});

export const ledgerEntryUpdateSchema = z.object({
  date: z.string().optional(),
  po_number: z.string().trim().optional(),
  dr_number: z.string().trim().optional(),
  client_name: z.string().trim().optional(),
  driver_name: z.string().trim().nullable().optional(),
  plate_number: z.string().trim().nullable().optional(),
  destination: z.string().trim().nullable().optional(),
  service_type: z.enum(['pickup', 'deliver']).optional(),
  jb: z.number().int().min(0).optional(),
  sb: z.number().int().min(0).optional(),
  payment_method: z.enum(['cash', 'check']).optional(),
  check_number: z.string().nullable().optional(),
  amount: z.number().min(0).optional(),
  bags_returned: z.number().int().min(0).optional(),
  bag_returned_type: z.enum(['JB', 'SB']).nullable().optional(),
  return_reason: z.string().optional(),
  notes: z.string().nullable().optional(),
});

// ─── Warehouse Report ───────────────────────────────────────────
export const warehouseReportSaveSchema = z.object({
  report_date: z.string().min(1),
  yesterday_jb: z.number().int().min(0),
  yesterday_sb: z.number().int().min(0),
  received_jb: z.number().int().min(0),
  received_sb: z.number().int().min(0),
  dispatched_jb: z.number().int().min(0),
  dispatched_sb: z.number().int().min(0),
  returned_jb: z.number().int().min(0),
  returned_sb: z.number().int().min(0),
  waste_jb: z.number().int().min(0),
  waste_sb: z.number().int().min(0),
  closing_jb: z.number().int().min(0),
  closing_sb: z.number().int().min(0),
  notes: z.string().nullable().optional(),
});

// ─── Product ────────────────────────────────────────────────────
export const productUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  price_per_bag: z.number().min(0).optional(),
  bag_type: z.enum(['JB', 'SB']).optional(),
  price_port: z.number().min(0).nullable().optional(),
  price_warehouse: z.number().min(0).nullable().optional(),
  is_active: z.boolean().optional(),
  image_url: z.string().url().nullable().optional(),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  bag_type: z.enum(['JB', 'SB']),
  price_per_bag: z.number().min(0),
  price_port: z
    .number()
    .min(0)
    .nullable()
    .default(0)
    .transform((v) => v ?? 0),
  price_warehouse: z
    .number()
    .min(0)
    .nullable()
    .default(0)
    .transform((v) => v ?? 0),
  is_active: z.boolean().default(true),
  image_url: z.string().url().nullable().optional(),
});

// ─── Manual Client ──────────────────────────────────────────────
export const manualClientCreateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1),
  password: z.string().min(6),
  phone: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  accountType: z.enum(['individual', 'company']).optional(),
  addressStreet: z.string().trim().optional(),
  addressCity: z.string().trim().optional(),
  addressProvince: z.string().trim().optional(),
  addressPostalCode: z.string().trim().optional(),
  businessPermitNo: z.string().trim().optional(),
  tinNo: z.string().trim().optional(),
});

// ─── Cost Config ────────────────────────────────────────────────
export const costConfigSchema = z.object({
  landed_cost_per_bag: z.number().min(0),
  local_expenses_per_bag: z.number().min(0),
});

// ─── Customer Balance ──────────────────────────────────────────
export const customerBalanceUpdateSchema = z.object({
  remaining_qty: z.number().int().min(0),
  status: z.enum(['pending', 'fulfilled']),
});
