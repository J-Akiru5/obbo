export const mockOrders = [
  {
    id: 'order-001',
    client_id: 'client-001',
    status: 'pending',
    total_amount: 5000,
    payment_method: 'cash',
    po_number: 'PO-2026-001',
    po_image_url: null,
    source: 'warehouse',
    service_type: 'pickup',
    shipping_fee: 0,
    tracking_status: 'pending_dispatch',
    order_type: 'new',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    client: {
      id: 'client-001',
      full_name: 'Juan Dela Cruz',
      company_name: 'ACME Construction',
      email: 'juan@acme.com',
      phone: '09171234567',
      avatar_url: null,
    },
    items: [
      {
        id: 'item-001',
        order_id: 'order-001',
        product_id: 'prod-jb-001',
        bag_type: 'JB',
        requested_qty: 100,
        approved_qty: 0,
        dispatched_qty: 0,
        product: { name: 'Portland Cement Type 1', bag_type: 'JB', price_per_bag: 250 },
      },
    ],
  },
];

export const mockOrderItems = [
  {
    id: 'item-001',
    order_id: 'order-001',
    product_id: 'prod-jb-001',
    bag_type: 'JB',
    requested_qty: 100,
    approved_qty: 0,
    dispatched_qty: 0,
    selling_price_per_bag: 250,
  },
];

export const mockCustomerBalances = [
  {
    id: 'bal-001',
    client_id: 'client-001',
    order_id: 'order-001',
    product_id: 'prod-jb-001',
    bag_type: 'JB',
    total_purchase: 100,
    remaining_qty: 25,
    status: 'pending',
    created_at: '2026-06-01T00:00:00.000Z',
  },
];
