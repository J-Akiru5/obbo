import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PoListTab } from './po-list-tab';
import { DrListTab } from './dr-list-tab';
import type { PurchaseOrder, DeliveryReceipt, Shipment } from '@/lib/types/database';

// Both tabs render the list table AND the mobile card grid at the same time
// (Tailwind's `hidden`/`sm:hidden` classes do nothing under jsdom), so each
// per-type string legitimately appears more than once. Assert on presence.

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mixedPo = {
  id: 'po-1',
  po_number: 'PO-2026-001',
  client_name: 'Mixed Client',
  date: '2026-06-01',
  status: 'pending',
  source: 'warehouse',
  service_type: 'pickup',
  // One order carrying BOTH bag types — the regression case. The old tables
  // summed these into a single number and stamped it with one type badge.
  // purchase_orders.jb/sb are JB/SB UNITS, same as delivery_receipts:
  // 2 JB units = 50 bags, 2 SB units = 100 bags.
  jb: 2,
  sb: 2,
  check_number: null,
  check_amount: null,
  cash_amount: 0,
  photo_url: null,
  order_id: null,
} as unknown as PurchaseOrder;

const sbOnlyPo = {
  ...mixedPo,
  id: 'po-2',
  po_number: 'PO-2026-002',
  jb: 0,
  sb: 2, // 2 SB units = 100 bags
} as unknown as PurchaseOrder;

const mixedDr = {
  id: 'dr-1',
  dr_number: 'DR-2026-001',
  client_name: 'Mixed Client',
  po_number: 'PO-2026-001',
  // delivery_receipts.jb/sb are JB/SB UNITS, so 2 JB units = 50 bags and
  // 2 SB units = 100 bags.
  jb: 2,
  sb: 2,
  quantity: 4,
  bag_type: 'JB', // legacy denormalized hint — display must NOT rely on it
  received_date: '2026-06-01',
  driver: 'Juan Dela Cruz',
  plate_number: 'GOI 2842',
  shipping_fee: 0,
  destination: null,
  dr_image_url: null,
  order_id: null,
  shipment_id: 'ship-1',
} as unknown as DeliveryReceipt;

const shipments = [
  { id: 'ship-1', batch_name: 'VESSEL 1', remaining_jb: 500, remaining_sb: 500 },
] as unknown as Shipment[];

describe('PoListTab per-bag-type quantity', () => {
  it('shows a mixed order as separate JB and SB counts, never lumped under one type', () => {
    render(<PoListTab purchaseOrders={[mixedPo]} loading={false} onReload={vi.fn()} />);

    // Old behaviour summed the row to 150 and stamped a single "JB" badge.
    // (The top summary card also totals 150 bags here — 2 JB units + 2 SB
    // units converted to individual bags — matching the per-row breakdown.)
    expect(screen.getAllByText('50 JB · 100 SB').length).toBeGreaterThan(0);
  });

  it('shows a single-type order with only that type', () => {
    render(<PoListTab purchaseOrders={[sbOnlyPo]} loading={false} onReload={vi.fn()} />);

    expect(screen.getAllByText('100 SB').length).toBeGreaterThan(0);
    expect(screen.queryByText('50 JB · 100 SB')).toBeNull();
  });
});

describe('DrListTab per-bag-type quantity', () => {
  it('converts stored units to bags and lists both types for a mixed DR', () => {
    render(
      <DrListTab
        deliveryReceipts={[mixedDr]}
        shipments={shipments}
        purchaseOrders={[]}
        loading={false}
        onReload={vi.fn()}
      />,
    );

    // 2 JB units = 50 bags, 2 SB units = 100 bags. The old desktop table
    // summed these to 150 and labelled the whole thing "JB" via
    // `dr.jb > 0 ? 'JB' : 'SB'`, ignoring the stored bag_type entirely.
    expect(screen.getAllByText('50 JB · 100 SB').length).toBeGreaterThan(0);
    expect(screen.queryByText('150')).toBeNull();
  });
});
