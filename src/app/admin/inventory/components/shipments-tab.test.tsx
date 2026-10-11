import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Shipment, ShipmentLedgerEntry } from '@/lib/types/database';

const { fetchShipmentLedger } = vi.hoisted(() => ({ fetchShipmentLedger: vi.fn() }));

vi.mock('@/lib/actions/admin-actions', () => ({
  createShipment: vi.fn(),
  fetchShipmentLedger,
  addLedgerEntry: vi.fn(),
  updateLedgerEntry: vi.fn(),
  updateShipment: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ShipmentsTab } from './shipments-tab';

const shipment = {
  id: 'ship-1',
  batch_name: 'BATCH-SRC',
  product_id: null,
  bag_type: null,
  initial_quantity: 1000,
  good_stock: 1000,
  damaged_stock: 0,
  total_jb: 500,
  total_sb: 500,
  remaining_jb: 500,
  remaining_sb: 500,
  arrival_date: '2026-10-01',
  notes: null,
  damaged_jb: 0,
  damaged_sb: 0,
  created_at: '2026-10-01T00:00:00Z',
} as Shipment;

function ledgerEntry(over: Partial<ShipmentLedgerEntry>): ShipmentLedgerEntry {
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
    profit_basis_price_per_bag: null,
    created_at: '2026-10-02T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
    ...over,
  };
}

function renderExpanded() {
  render(<ShipmentsTab shipments={[shipment]} loading={false} onReload={vi.fn()} />);
  fireEvent.click(screen.getByText('BATCH-SRC'));
}

describe('ShipmentsTab — ledger Source column', () => {
  beforeEach(() => {
    fetchShipmentLedger.mockReset();
  });

  it('adds a Source header right after Service (22 columns in total)', async () => {
    fetchShipmentLedger.mockResolvedValue([ledgerEntry({ source: 'port' })]);
    renderExpanded();

    const table = await screen.findByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent?.trim());

    expect(headers).toHaveLength(22);
    expect(headers[headers.indexOf('Service') + 1]).toBe('Source');
  });

  it('renders Port / Warehouse in the Source cell and "—" for a NULL (legacy) row', async () => {
    fetchShipmentLedger.mockResolvedValue([
      ledgerEntry({ id: 'l-port', dr_number: 'DR-PORT', source: 'port' }),
      ledgerEntry({ id: 'l-wh', dr_number: 'DR-WH', source: 'warehouse' }),
      ledgerEntry({ id: 'l-null', dr_number: 'DR-NONE', source: null }),
    ]);
    renderExpanded();

    const table = await screen.findByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent?.trim());
    const sourceIdx = headers.indexOf('Source');

    const sourceCellFor = (dr: string) => {
      const row = within(table).getByText(dr).closest('tr')!;
      return within(row).getAllByRole('cell')[sourceIdx].textContent?.trim();
    };

    expect(sourceCellFor('DR-PORT')).toBe('Port');
    expect(sourceCellFor('DR-WH')).toBe('Warehouse');
    expect(sourceCellFor('DR-NONE')).toBe('—');
  });

  it('shows the same Source tag on the mobile card (table row + card = 2 occurrences)', async () => {
    fetchShipmentLedger.mockResolvedValue([
      ledgerEntry({ id: 'l-port', dr_number: 'DR-PORT', source: 'port' }),
      ledgerEntry({ id: 'l-wh', dr_number: 'DR-WH', source: 'warehouse' }),
    ]);
    renderExpanded();

    await screen.findByRole('table');
    expect(screen.getAllByText('Port')).toHaveLength(2);
    expect(screen.getAllByText('Warehouse')).toHaveLength(2);
  });

  it('spans all 22 columns in the "No ledger entries yet." placeholder row', async () => {
    fetchShipmentLedger.mockResolvedValue([]);
    renderExpanded();

    const table = await screen.findByRole('table');
    const cell = await within(table).findByText('No ledger entries yet.');
    expect(cell.closest('td')).toHaveAttribute('colspan', '22');
  });

  it('spans all 22 columns in the "Loading..." placeholder row', async () => {
    fetchShipmentLedger.mockReturnValue(new Promise(() => {})); // never resolves
    renderExpanded();

    const table = await screen.findByRole('table');
    const cell = within(table).getByText('Loading...');
    expect(cell.closest('td')).toHaveAttribute('colspan', '22');
  });
});
