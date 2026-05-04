// Database types aligned with Supabase schema

export type BagType = 'JB' | 'SB';
export type UserRole = 'admin' | 'client' | 'warehouse_manager';
export type KycStatus = 'pending_verification' | 'verified' | 'rejected';
export type PaymentMethod = 'cash' | 'check';
export type OrderStatus =
    | 'pending'
    | 'approved'
    | 'partially_approved'
    | 'awaiting_check'
    | 'dispatched'
    | 'completed'
    | 'rejected';
export type BalanceStatus = 'pending' | 'fulfilled';
export type OrderSource = 'port' | 'warehouse';
export type ServiceType = 'pickup' | 'deliver';
export type TrackingStatus = 'pending_dispatch' | 'in_transit' | 'delivered' | 'bags_returned';

export type OrderType = 'new' | 'redelivery' | 'draft';

export interface Profile {
    id: string;
    email: string;
    full_name: string;
    first_name?: string | null;
    surname?: string | null;
    account_type?: string | null;
    company_name: string | null;
    contact_person_first_name?: string | null;
    contact_person_surname?: string | null;
    phone: string | null;
    address_street?: string | null;
    address_city?: string | null;
    address_province?: string | null;
    address_postal_code?: string | null;
    business_permit_no?: string | null;
    tin_no?: string | null;
    role: UserRole;
    kyc_status: KycStatus;
    kyc_documents: string[] | null;
    avatar_url: string | null;
    notification_preferences: {
        order_approval: boolean;
        payment_required: boolean;
        dispatch: boolean;
        delivery_status: boolean;
    } | null;
    created_at: string;
    updated_at: string;
}

export interface Product {
    id: string;
    name: string;
    description: string;
    bag_type: BagType;
    price_per_bag: number;
    price_port: number | null;
    price_warehouse: number | null;
    image_url: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Shipment {
    id: string;
    batch_name: string;
    product_id: string | null;
    product?: Product;
    bag_type: BagType | null;
    initial_quantity: number;
    good_stock: number;
    damaged_stock: number;
    total_jb: number;
    total_sb: number;
    remaining_jb: number;
    remaining_sb: number;
    arrival_date: string;
    notes: string | null;
    created_at: string;
}

export interface ShipmentLedgerEntry {
    id: string;
    shipment_id: string;
    date: string;
    dr_number: string | null;
    po_number: string | null;
    client_name: string | null;
    jb: number;
    sb: number;
    bags_returned: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface DeliveryReceipt {
    id: string;
    shipment_id: string;
    dr_number: string;
    quantity: number;
    bag_type: BagType;
    received_date: string;
    notes: string | null;
    po_number: string | null;
    client_name: string | null;
    client_id: string | null;
    jb: number;
    sb: number;
    driver: string | null;
    plate_number: string | null;
    shipping_fee: number | null;
    dr_image_url: string | null;
    created_at: string;
}

export interface Order {
    id: string;
    client_id: string;
    client?: Profile;
    status: OrderStatus;
    items: OrderItem[];
    total_amount: number;
    payment_method: PaymentMethod;
    check_image_url: string | null;
    check_number: string | null;
    notes: string | null;
    po_number: string | null;
    po_image_url: string | null;
    source: OrderSource;
    service_type: ServiceType;
    shipping_fee: number;
    dr_number: string | null;
    dr_image_url: string | null;
    driver_name: string | null;
    plate_number: string | null;
    rejection_reason: string | null;
    tracking_status: TrackingStatus;
    bags_returned_jb: number;
    bags_returned_sb: number;
    shipment_id: string | null;
    // Split delivery fields
    is_split_delivery: boolean;
    deliver_now_qty: number;
    supplier_name: string | null;
    preferred_pickup_date: string | null;
    order_type: OrderType;
    linked_po_number: string | null;
    created_at: string;
    updated_at: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    product?: Product;
    bag_type: BagType;
    requested_qty: number;
    approved_qty: number;
    dispatched_qty: number;
}

export interface CustomerBalance {
    id: string;
    client_id: string;
    client?: Profile;
    order_id: string;
    product_id: string;
    product?: Product;
    bag_type: BagType;
    remaining_qty: number;
    status: BalanceStatus;
    created_at: string;
}

export interface PurchaseOrder {
    id: string;
    date: string;
    po_number: string;
    client_id: string | null;
    client_name: string | null;
    jb: number;
    sb: number;
    status: string;
    source: OrderSource | null;
    service_type: ServiceType | null;
    shipment_id: string | null;
    order_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface WarehouseReport {
    id: string;
    report_date: string;
    yesterday_jb: number;
    yesterday_sb: number;
    received_jb: number;
    received_sb: number;
    dispatched_jb: number;
    dispatched_sb: number;
    returned_jb: number;
    returned_sb: number;
    waste_jb: number;
    waste_sb: number;
    closing_jb: number;
    closing_sb: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AdminSetting {
    id: string;
    key: string;
    value: Record<string, unknown>;
    updated_at: string;
}

export interface ActivityLog {
    id: string;
    actor_id: string;
    actor?: Profile;
    action: string;
    entity_type: string;
    entity_id: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    href: string | null;
    severity: 'info' | 'warning' | 'success';
    is_read: boolean;
    created_at: string;
}
