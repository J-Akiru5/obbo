import {
    Profile, Product, Shipment, Order, OrderItem,
    CustomerBalance, ActivityLog, DeliveryReceipt
} from '@/lib/types/database';

// ─── Profiles ──────────────────────────────────────────────
export const mockProfiles: Profile[] = [
    {
        id: 'admin-001',
        email: 'admin@obbo.com',
        full_name: 'Juan Dela Cruz',
        company_name: 'OBBO Cement Corp',
        phone: '+63 912 345 6789',
        role: 'admin',
        kyc_status: 'verified',
        kyc_documents: null,
        avatar_url: null,
        created_at: '2025-01-15T08:00:00Z',
        updated_at: '2025-01-15T08:00:00Z',
    },
    {
        id: 'client-001',
        email: 'maria@buildersph.com',
        full_name: 'Maria Santos',
        company_name: 'Builders PH Inc.',
        phone: '+63 917 888 1234',
        role: 'client',
        kyc_status: 'verified',
        kyc_documents: ['kyc_doc_1.pdf'],
        avatar_url: null,
        created_at: '2025-02-01T10:00:00Z',
        updated_at: '2025-02-05T10:00:00Z',
    },
    {
        id: 'client-002',
        email: 'pedro@concreteking.com',
        full_name: 'Pedro Reyes',
        company_name: 'Concrete King Corp',
        phone: '+63 918 555 4321',
        role: 'client',
        kyc_status: 'verified',
        kyc_documents: ['kyc_doc_2.pdf'],
        avatar_url: null,
        created_at: '2025-02-10T14:00:00Z',
        updated_at: '2025-02-12T14:00:00Z',
    },
    {
        id: 'client-003',
        email: 'ana@newbuild.com',
        full_name: 'Ana Garcia',
        company_name: 'New Build Supplies',
        phone: '+63 919 111 2222',
        role: 'client',
        kyc_status: 'pending_verification',
        kyc_documents: ['id_front.jpg', 'business_permit.pdf'],
        avatar_url: null,
        created_at: '2025-04-20T09:00:00Z',
        updated_at: '2025-04-20T09:00:00Z',
    },
    {
        id: 'client-004',
        email: 'rico@megacon.com',
        full_name: 'Rico Mendoza',
        company_name: 'MegaCon Developers',
        phone: '+63 920 333 4444',
        role: 'client',
        kyc_status: 'pending_verification',
        kyc_documents: ['govt_id.jpg'],
        avatar_url: null,
        created_at: '2025-04-22T11:00:00Z',
        updated_at: '2025-04-22T11:00:00Z',
    },
];

// ─── Products ──────────────────────────────────────────────
export const mockProducts: Product[] = [
    {
        id: 'prod-001',
        name: 'Portland Cement Type I',
        description: 'General-purpose cement suitable for most construction applications. 40kg per bag.',
        bag_type: 'SB',
        price_per_bag: 250,
        image_url: null,
        is_active: true,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'prod-002',
        name: 'Portland Cement Type I (Jumbo)',
        description: 'General-purpose cement in jumbo bags for large-scale projects. 1 ton per bag.',
        bag_type: 'JB',
        price_per_bag: 5800,
        image_url: null,
        is_active: true,
        created_at: '2025-01-01T00:00:00Z',
    },
    {
        id: 'prod-003',
        name: 'Portland Cement Type II',
        description: 'Moderate sulfate-resistant cement for structures exposed to soil/water. 40kg per bag.',
        bag_type: 'SB',
        price_per_bag: 275,
        image_url: null,
        is_active: true,
        created_at: '2025-01-15T00:00:00Z',
    },
    {
        id: 'prod-004',
        name: 'Blended Cement Premium',
        description: 'High-performance blended cement for specialized structural work. 40kg per bag.',
        bag_type: 'SB',
        price_per_bag: 290,
        image_url: null,
        is_active: true,
        created_at: '2025-02-01T00:00:00Z',
    },
];

// ─── Shipments ──────────────────────────────────────────────
export const mockShipments: Shipment[] = [
    {
        id: 'ship-001',
        batch_name: 'BATCH-2025-001',
        product_id: 'prod-001',
        bag_type: 'SB',
        initial_quantity: 5000,
        good_stock: 4850,
        damaged_stock: 150,
        arrival_date: '2025-03-01T00:00:00Z',
        notes: 'First batch for Q1',
        created_at: '2025-03-01T08:00:00Z',
    },
    {
        id: 'ship-002',
        batch_name: 'BATCH-2025-002',
        product_id: 'prod-002',
        bag_type: 'JB',
        initial_quantity: 200,
        good_stock: 195,
        damaged_stock: 5,
        arrival_date: '2025-03-10T00:00:00Z',
        notes: 'Jumbo batch shipment',
        created_at: '2025-03-10T08:00:00Z',
    },
    {
        id: 'ship-003',
        batch_name: 'BATCH-2025-003',
        product_id: 'prod-003',
        bag_type: 'SB',
        initial_quantity: 3000,
        good_stock: 2980,
        damaged_stock: 20,
        arrival_date: '2025-03-20T00:00:00Z',
        notes: 'Type II cement batch',
        created_at: '2025-03-20T08:00:00Z',
    },
    {
        id: 'ship-004',
        batch_name: 'BATCH-2025-004',
        product_id: 'prod-004',
        bag_type: 'SB',
        initial_quantity: 2000,
        good_stock: 2000,
        damaged_stock: 0,
        arrival_date: '2025-04-01T00:00:00Z',
        notes: 'Premium blend batch',
        created_at: '2025-04-01T08:00:00Z',
    },
];

// ─── Delivery Receipts ──────────────────────────────────────
export const mockDeliveryReceipts: DeliveryReceipt[] = [
    {
        id: 'dr-001',
        shipment_id: 'ship-001',
        dr_number: 'DR-2025-0001',
        quantity: 5000,
        bag_type: 'SB',
        received_date: '2025-03-01T10:00:00Z',
        notes: 'Full shipment received',
        created_at: '2025-03-01T10:00:00Z',
    },
    {
        id: 'dr-002',
        shipment_id: 'ship-002',
        dr_number: 'DR-2025-0002',
        quantity: 200,
        bag_type: 'JB',
        received_date: '2025-03-10T11:00:00Z',
        notes: null,
        created_at: '2025-03-10T11:00:00Z',
    },
];

// ─── Orders ──────────────────────────────────────────────
export const mockOrderItems: OrderItem[] = [
    { id: 'oi-001', order_id: 'ord-001', product_id: 'prod-001', bag_type: 'SB', requested_qty: 500, approved_qty: 500, dispatched_qty: 500 },
    { id: 'oi-002', order_id: 'ord-002', product_id: 'prod-002', bag_type: 'JB', requested_qty: 50, approved_qty: 30, dispatched_qty: 30 },
    { id: 'oi-003', order_id: 'ord-003', product_id: 'prod-001', bag_type: 'SB', requested_qty: 1000, approved_qty: 0, dispatched_qty: 0 },
    { id: 'oi-004', order_id: 'ord-004', product_id: 'prod-003', bag_type: 'SB', requested_qty: 800, approved_qty: 800, dispatched_qty: 0 },
    { id: 'oi-005', order_id: 'ord-005', product_id: 'prod-004', bag_type: 'SB', requested_qty: 300, approved_qty: 0, dispatched_qty: 0 },
];

export const mockOrders: Order[] = [
    {
        id: 'ord-001',
        client_id: 'client-001',
        client: mockProfiles[1],
        status: 'completed',
        items: [mockOrderItems[0]],
        total_amount: 125000,
        payment_method: 'cash',
        check_image_url: null,
        check_number: null,
        notes: 'Urgent delivery needed',
        created_at: '2025-03-15T09:00:00Z',
        updated_at: '2025-03-16T14:00:00Z',
    },
    {
        id: 'ord-002',
        client_id: 'client-002',
        client: mockProfiles[2],
        status: 'dispatched',
        items: [mockOrderItems[1]],
        total_amount: 174000,
        payment_method: 'cash',
        check_image_url: null,
        check_number: null,
        notes: 'Partial delivery accepted',
        created_at: '2025-04-01T10:00:00Z',
        updated_at: '2025-04-03T08:00:00Z',
    },
    {
        id: 'ord-003',
        client_id: 'client-001',
        client: mockProfiles[1],
        status: 'pending',
        items: [mockOrderItems[2]],
        total_amount: 250000,
        payment_method: 'check',
        check_image_url: null,
        check_number: null,
        notes: 'New order for project Phase 2',
        created_at: '2025-04-20T11:00:00Z',
        updated_at: '2025-04-20T11:00:00Z',
    },
    {
        id: 'ord-004',
        client_id: 'client-002',
        client: mockProfiles[2],
        status: 'approved',
        items: [mockOrderItems[3]],
        total_amount: 220000,
        payment_method: 'cash',
        check_image_url: null,
        check_number: null,
        notes: 'Ready for dispatch',
        created_at: '2025-04-18T08:00:00Z',
        updated_at: '2025-04-19T10:00:00Z',
    },
    {
        id: 'ord-005',
        client_id: 'client-001',
        client: mockProfiles[1],
        status: 'pending',
        items: [mockOrderItems[4]],
        total_amount: 87000,
        payment_method: 'cash',
        check_image_url: null,
        check_number: null,
        notes: null,
        created_at: '2025-04-25T14:00:00Z',
        updated_at: '2025-04-25T14:00:00Z',
    },
];

// ─── Customer Balances ──────────────────────────────────────
export const mockCustomerBalances: CustomerBalance[] = [
    {
        id: 'bal-001',
        client_id: 'client-002',
        order_id: 'ord-002',
        product_id: 'prod-002',
        bag_type: 'JB',
        remaining_qty: 20,
        status: 'pending',
        created_at: '2025-04-03T08:00:00Z',
    },
];

// ─── Activity Log ──────────────────────────────────────
export const mockActivityLog: ActivityLog[] = [
    {
        id: 'act-001',
        actor_id: 'client-001',
        actor: mockProfiles[1],
        action: 'order_placed',
        entity_type: 'order',
        entity_id: 'ord-005',
        metadata: { total: 87000 },
        created_at: '2025-04-25T14:00:00Z',
    },
    {
        id: 'act-002',
        actor_id: 'client-004',
        actor: mockProfiles[4],
        action: 'kyc_submitted',
        entity_type: 'profile',
        entity_id: 'client-004',
        metadata: { documents: 1 },
        created_at: '2025-04-22T11:00:00Z',
    },
    {
        id: 'act-003',
        actor_id: 'admin-001',
        actor: mockProfiles[0],
        action: 'order_dispatched',
        entity_type: 'order',
        entity_id: 'ord-002',
        metadata: { bags: 30, type: 'JB' },
        created_at: '2025-04-03T08:00:00Z',
    },
    {
        id: 'act-004',
        actor_id: 'admin-001',
        actor: mockProfiles[0],
        action: 'order_approved',
        entity_type: 'order',
        entity_id: 'ord-004',
        metadata: { approved_qty: 800 },
        created_at: '2025-04-19T10:00:00Z',
    },
    {
        id: 'act-005',
        actor_id: 'client-003',
        actor: mockProfiles[3],
        action: 'kyc_submitted',
        entity_type: 'profile',
        entity_id: 'client-003',
        metadata: { documents: 2 },
        created_at: '2025-04-20T09:00:00Z',
    },
    {
        id: 'act-006',
        actor_id: 'admin-001',
        actor: mockProfiles[0],
        action: 'shipment_added',
        entity_type: 'shipment',
        entity_id: 'ship-004',
        metadata: { batch: 'BATCH-2025-004', qty: 2000 },
        created_at: '2025-04-01T08:00:00Z',
    },
];

// ─── Helper: compute net available stock ──────────────────
export function computeNetStock() {
    const totalGoodStock = mockShipments.reduce((sum, s) => sum + s.good_stock, 0);
    const totalBalances = mockCustomerBalances
        .filter((b) => b.status === 'pending')
        .reduce((sum, b) => sum + b.remaining_qty, 0);
    return { totalGoodStock, totalBalances, netAvailable: totalGoodStock - totalBalances };
}

export function computeStockByType() {
    const jb = mockShipments.filter(s => s.bag_type === 'JB').reduce((sum, s) => sum + s.good_stock, 0);
    const sb = mockShipments.filter(s => s.bag_type === 'SB').reduce((sum, s) => sum + s.good_stock, 0);
    const jbBal = mockCustomerBalances.filter(b => b.bag_type === 'JB' && b.status === 'pending').reduce((sum, b) => sum + b.remaining_qty, 0);
    const sbBal = mockCustomerBalances.filter(b => b.bag_type === 'SB' && b.status === 'pending').reduce((sum, b) => sum + b.remaining_qty, 0);
    return {
        jb: { good: jb, balance: jbBal, net: jb - jbBal },
        sb: { good: sb, balance: sbBal, net: sb - sbBal },
    };
}
