import { http, HttpResponse } from 'msw';
import { mockShipments, mockShipmentLedger } from '../fixtures/shipments';

let shipmentIdCounter = 100;

export const shipmentHandlers = [
  http.get('*/rest/v1/shipments', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    if (id) {
      return HttpResponse.json(mockShipments.filter((s) => s.id === id));
    }
    return HttpResponse.json(mockShipments);
  }),

  http.post('*/rest/v1/shipments', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newShipment = {
      id: `ship-${++shipmentIdCounter}`,
      ...body,
      created_at: new Date().toISOString(),
    };
    mockShipments.push(newShipment as (typeof mockShipments)[0]);
    return HttpResponse.json([newShipment]);
  }),

  http.patch('*/rest/v1/shipments', async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const body = (await request.json()) as Record<string, unknown>;
    const idx = mockShipments.findIndex((s) => s.id === id);
    if (idx !== -1) {
      mockShipments[idx] = { ...mockShipments[idx], ...body } as (typeof mockShipments)[0];
    }
    return HttpResponse.json([]);
  }),
];

export const shipmentLedgerHandlers = [
  http.get('*/rest/v1/shipment_ledger', ({ request }) => {
    const url = new URL(request.url);
    const shipmentId = url.searchParams.get('shipment_id')?.replace('eq.', '');
    const drNumber = url.searchParams.get('dr_number')?.replace('eq.', '');
    const poNumber = url.searchParams.get('po_number')?.replace('eq.', '');
    // PostgREST serializes .in('po_number', [...]) as po_number=in.(A,B).
    // sumLedgerSalesForPoFamily relies on this filter to compute the PO
    // revenue cap, so honor it rather than returning every row.
    const poInParam = url.searchParams.get('po_number') ?? '';
    let result = [...mockShipmentLedger];
    if (shipmentId) result = result.filter((l) => l.shipment_id === shipmentId);
    if (drNumber) result = result.filter((l) => l.dr_number === drNumber);
    if (poInParam.startsWith('in.(')) {
      const wanted = poInParam.slice(4, -1).split(',');
      result = result.filter((l) => wanted.includes(l.po_number));
    } else if (poNumber) {
      result = result.filter((l) => l.po_number === poNumber);
    }
    return HttpResponse.json(result);
  }),

  http.post('*/rest/v1/shipment_ledger', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const newEntry = {
      id: `ledger-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockShipmentLedger.push(newEntry as (typeof mockShipmentLedger)[0]);
    return HttpResponse.json([newEntry]);
  }),

  http.patch('*/rest/v1/shipment_ledger', async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const body = (await request.json()) as Record<string, unknown>;
    const idx = mockShipmentLedger.findIndex((l) => l.id === id);
    if (idx !== -1) {
      mockShipmentLedger[idx] = {
        ...mockShipmentLedger[idx],
        ...body,
        updated_at: new Date().toISOString(),
      } as (typeof mockShipmentLedger)[0];
    }
    return HttpResponse.json([]);
  }),
];
