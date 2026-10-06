import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FulfillmentTab, buildShipmentBatchOptions } from './fulfillment-tab';
import type { Order, Shipment } from '@/lib/types/database';

const shipment = {
  id: 'ship-1',
  batch_name: 'VESSEL 1',
  remaining_jb: 198704,
  remaining_sb: 343550,
} as unknown as Shipment;

describe('buildShipmentBatchOptions', () => {
  it('uses a SHORT trigger label and keeps availability detail only in the full label', () => {
    const [option] = buildShipmentBatchOptions([shipment], 1100, 0); // 44 JB units

    // Trigger label — must never contain the long Available/Needed string
    // that overflowed the dispatch modal.
    expect(option.label).toBe('VESSEL 1');
    expect(option.label).not.toMatch(/Available|Needed/);

    // Full detail still available for the popup option + summary card.
    expect(option.fullLabel).toContain('198,704 bags JB / 343,550 bags SB');
    expect(option.fullLabel).toContain('Needed: 1,100 bags JB');
    expect(option.hasEnough).toBe(true);
    expect(option.disabled).toBe(false);
  });

  it('flags and disables a batch with insufficient stock', () => {
    const [option] = buildShipmentBatchOptions([shipment], 199000, 0);

    expect(option.label).toBe('VESSEL 1 — INSUFFICIENT');
    expect(option.fullLabel).toContain('INSUFFICIENT STOCK');
    expect(option.hasEnough).toBe(false);
    expect(option.disabled).toBe(true);
  });

  it('lists both bag types in the need label for mixed orders', () => {
    const [option] = buildShipmentBatchOptions([shipment], 25, 100);
    expect(option.needLabel).toBe('25 bags JB, 100 bags SB');
  });
});

const order = {
  id: 'order-1',
  status: 'approved',
  service_type: 'pickup',
  payment_method: 'cash',
  total_amount: 203500,
  driver_name: 'Danny Driver',
  plate_number: 'ABC1234',
  po_image_url: null,
  check_image_url: null,
  check_number: null,
  notes: null,
  is_split_delivery: false,
  deliver_now_jb: 0,
  deliver_now_sb: 0,
  items: [
    {
      id: 'item-1',
      bag_type: 'JB',
      requested_qty: 48,
      approved_qty: 44,
      dispatched_qty: 0,
      selling_price_per_bag: 185,
    },
  ],
  client: { full_name: 'Roxanne Agub', company_name: null, avatar_url: null },
  delivery_receipts: [],
} as unknown as Order;

describe('FulfillmentTab dispatch modal', () => {
  it('renders a truncating trigger and a wrapping summary card for the selected batch', async () => {
    const user = userEvent.setup();
    render(
      <FulfillmentTab
        orders={[order]}
        shipments={[shipment]}
        onDispatch={vi.fn()}
        loading={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /dispatch now/i }));

    const trigger = await screen.findByRole('combobox');
    // The trigger must clip long content instead of overflowing the modal.
    expect(trigger.className).toContain('min-w-0');
    expect(trigger.className).toContain('overflow-hidden');

    await user.click(trigger);

    // Full detail is rendered inside the popup option (wrapping).
    const optionLabel = await screen.findByText(/Available: 198,704 bags JB \/ 343,550 bags SB/);
    await user.click(optionLabel);

    // Selected batch shows the short name in the trigger plus a summary card
    // with the full numbers.
    expect(trigger.textContent).toContain('VESSEL 1');
    expect(trigger.textContent).not.toContain('Available');
    expect(await screen.findByText('198,704 bags JB / 343,550 bags SB available')).toBeVisible();
    expect(screen.getByText('Needed: 1,100 bags JB')).toBeVisible();
  });
});
