// Database types aligned with Supabase schema

export type BagType = 'JB' | 'SB';
export type UserRole = 'admin' | 'client';
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

export interface Profile {
    id: string;
    email: string;
    full_name: string;
    company_name: string | null;
    phone: string | null;
    role: UserRole;
    kyc_status: KycStatus;
    kyc_documents: string[] | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface Product {
    id: string;
    name: string;
    description: string;
    bag_type: BagType;
    price_per_bag: number;
    image_url: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Shipment {
    id: string;
    batch_name: string;
    product_id: string;
    product?: Product;
    bag_type: BagType;
    initial_quantity: number;
    good_stock: number;
    damaged_stock: number;
    arrival_date: string;
    notes: string | null;
    created_at: string;
}

export interface DeliveryReceipt {
    id: string;
    shipment_id: string;
    dr_number: string;
    quantity: number;
    bag_type: BagType;
    received_date: string;
    notes: string | null;
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
