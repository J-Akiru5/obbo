import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ShipmentLedgerEntry } from '@/lib/types/database';
import { ledgerEntryCreateSchema, ledgerEntryUpdateSchema } from '@/lib/actions/schemas';
import { LedgerEntryDialog } from './ledger-entry-dialog';

function existingEntry(over: Partial<ShipmentLedgerEntry> = {}): ShipmentLedgerEntry {
  return {
    id: 'l-1',
    shipment_id: 'ship-1',
    delivery_receipt_id: null,
    date: '2026-10-02',
    po_number: 'PO-1',
    dr_number: 'DR-1',
    client_name: 'Acme',
    driver_name: null,
    plate_number: null,
    destination: null,
    service_type: 'pickup',
    source: null,
    jb: 4,
    sb: 0,
    payment_method: 'cash',
    check_number: null,
    amount: 18000,
    bags_returned: 0,
    bag_returned_type: null,
    return_reason: null,
    client_reason: null,
    notes: null,
    total_sales: 18000,
    gross_profit: 3236,
    net_profit: 1236,
    selling_price_per_bag: 180,
    landed_cost_per_bag: 147.64,
    local_expenses_per_bag: 20,
    created_at: '2026-10-02T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
    ...over,
  };
}

async function submit(entry: ShipmentLedgerEntry | null) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<LedgerEntryDialog open onOpenChange={vi.fn()} entry={entry} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: entry ? 'Update Entry' : 'Add Entry' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  return onSubmit.mock.calls[0][0] as Record<string, unknown>;
}

describe('LedgerEntryDialog — Source field + payload contract', () => {
  it('shows a Source field', () => {
    render(<LedgerEntryDialog open onOpenChange={vi.fn()} entry={null} onSubmit={vi.fn()} />);
    expect(screen.getByText('Source')).toBeInTheDocument();
  });

  it('create with Source left blank omits it (so the server defaults it from the PO)', async () => {
    const payload = await submit(null);

    expect(payload.source).toBeUndefined();
    // Regression: the dialog used to send return_reason: null, which the
    // ledger schema rejects — so every plain manual add failed validation.
    expect(payload.return_reason).toBe('return');
    expect(ledgerEntryCreateSchema.safeParse(payload).success).toBe(true);
  });

  it('edit keeps the stored source and the payload passes the STRICT update schema', async () => {
    const payload = await submit(existingEntry({ source: 'port' }));

    expect(payload.source).toBe('port');
    expect(payload.return_reason).toBe('return');
    // The dialog always sends client_reason; strict mode must accept it.
    expect(payload).toHaveProperty('client_reason');
    expect(ledgerEntryUpdateSchema.safeParse(payload).success).toBe(true);
  });

  it('edit of a legacy row with no source sends an explicit null (leave unresolved)', async () => {
    const payload = await submit(existingEntry({ source: null }));

    expect(payload.source).toBeNull();
    expect(ledgerEntryUpdateSchema.safeParse(payload).success).toBe(true);
  });
});
