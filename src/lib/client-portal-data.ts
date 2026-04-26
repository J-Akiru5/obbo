export type CatalogSource = "PORT" | "WAREHOUSE";
export type ServiceType = "pick-up" | "deliver";
export type ClientPaymentMethod = "cash" | "check";

export type ClientOrderStatus =
  | "pending_approval"
  | "approved_payment_required"
  | "payment_submitted"
  | "in_transit"
  | "delivered"
  | "completed";

export interface ClientProduct {
  id: string;
  name: string;
  imageUrl: string;
  portPricePerBag: number;
  warehousePricePerBag: number;
  popular?: boolean;
}

export interface ClientOrderRecord {
  id: string;
  poNumber: string;
  productId: string;
  source: CatalogSource;
  serviceType: ServiceType;
  jbQty: number;
  sbQty: number;
  individualBagsNow: number;
  remainingBalanceBags: number;
  paymentMethod: ClientPaymentMethod;
  status: ClientOrderStatus;
  shippingFee: number;
  supplierName?: string;
  createdAt: string;
  updatedAt: string;
  drNumber?: string;
}

export interface ClientNotification {
  id: string;
  title: string;
  message: string;
  href: string;
  severity: "info" | "warning" | "success";
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  poNumber: string;
  productId: string;
  totalPurchased: number;
  totalDelivered: number;
  remainingBalance: number;
  lastMovementDate: string;
}

export const BAG_EQUIVALENT = {
  JB: 25,
  SB: 50,
} as const;

export const clientProfile = {
  id: "client-001",
  fullName: "Maria Santos",
  companyName: "Builders PH Inc.",
  email: "maria@buildersph.com",
  phone: "+63 917 888 1234",
  deliveryAddress: "Blk 6 Lot 14, Mabini St., Batangas City",
};

export const clientProducts: ClientProduct[] = [
  {
    id: "prod-portland-1",
    name: "Portland Cement Type I",
    imageUrl: "/hero-cement.png",
    portPricePerBag: 252,
    warehousePricePerBag: 248,
    popular: true,
  },
  {
    id: "prod-portland-2",
    name: "Portland Cement Type II",
    imageUrl: "/hero-cement.png",
    portPricePerBag: 268,
    warehousePricePerBag: 261,
    popular: true,
  },
  {
    id: "prod-blended-premium",
    name: "Blended Cement Premium",
    imageUrl: "/hero-cement.png",
    portPricePerBag: 295,
    warehousePricePerBag: 286,
  },
  {
    id: "prod-high-early",
    name: "High Early Strength Cement",
    imageUrl: "/hero-cement.png",
    portPricePerBag: 318,
    warehousePricePerBag: 309,
  },
];

export const clientOrdersSeed: ClientOrderRecord[] = [
  {
    id: "co-1001",
    poNumber: "PO-938401",
    productId: "prod-portland-1",
    source: "PORT",
    serviceType: "deliver",
    jbQty: 8,
    sbQty: 2,
    individualBagsNow: 280,
    remainingBalanceBags: 20,
    paymentMethod: "cash",
    status: "in_transit",
    shippingFee: 7600,
    supplierName: "OBBO Main Depot",
    createdAt: "2026-04-18T08:00:00Z",
    updatedAt: "2026-04-27T02:15:00Z",
    drNumber: "DR-2026-0097",
  },
  {
    id: "co-1002",
    poNumber: "PO-938452",
    productId: "prod-portland-2",
    source: "WAREHOUSE",
    serviceType: "pick-up",
    jbQty: 4,
    sbQty: 3,
    individualBagsNow: 250,
    remainingBalanceBags: 0,
    paymentMethod: "check",
    status: "pending_approval",
    shippingFee: 0,
    supplierName: "South Warehouse",
    createdAt: "2026-04-26T11:30:00Z",
    updatedAt: "2026-04-26T11:30:00Z",
  },
  {
    id: "co-1003",
    poNumber: "PO-938367",
    productId: "prod-blended-premium",
    source: "PORT",
    serviceType: "deliver",
    jbQty: 6,
    sbQty: 0,
    individualBagsNow: 100,
    remainingBalanceBags: 50,
    paymentMethod: "check",
    status: "approved_payment_required",
    shippingFee: 5200,
    supplierName: "OBBO Main Depot",
    createdAt: "2026-04-20T10:45:00Z",
    updatedAt: "2026-04-27T01:45:00Z",
  },
  {
    id: "co-1004",
    poNumber: "PO-938210",
    productId: "prod-portland-1",
    source: "WAREHOUSE",
    serviceType: "deliver",
    jbQty: 10,
    sbQty: 0,
    individualBagsNow: 250,
    remainingBalanceBags: 0,
    paymentMethod: "cash",
    status: "completed",
    shippingFee: 6800,
    supplierName: "North Warehouse",
    createdAt: "2026-04-06T09:10:00Z",
    updatedAt: "2026-04-09T05:20:00Z",
    drNumber: "DR-2026-0073",
  },
];

export const clientNotificationsSeed: ClientNotification[] = [
  {
    id: "n-001",
    title: "Order Approved",
    message: "PO-938367 was approved. Shipping fee is now available for payment.",
    href: "/client/orders",
    severity: "warning",
    createdAt: "2026-04-27T01:45:00Z",
  },
  {
    id: "n-002",
    title: "Shipment Update",
    message: "PO-938401 is now in transit to your delivery address.",
    href: "/client/orders",
    severity: "info",
    createdAt: "2026-04-27T02:15:00Z",
  },
  {
    id: "n-003",
    title: "Balance Available",
    message: "20 individual bags are available for re-delivery under PO-938401.",
    href: "/client/ledger",
    severity: "success",
    createdAt: "2026-04-27T03:10:00Z",
  },
];

export const ledgerEntriesSeed: LedgerEntry[] = [
  {
    id: "lg-001",
    poNumber: "PO-938401",
    productId: "prod-portland-1",
    totalPurchased: 300,
    totalDelivered: 280,
    remainingBalance: 20,
    lastMovementDate: "2026-04-27T02:15:00Z",
  },
  {
    id: "lg-002",
    poNumber: "PO-938367",
    productId: "prod-blended-premium",
    totalPurchased: 150,
    totalDelivered: 100,
    remainingBalance: 50,
    lastMovementDate: "2026-04-27T01:45:00Z",
  },
];

export const adminContact = {
  email: "imanage.support@obboholdings.com",
  phone: "+63 2 8888 1900",
  businessHours: "Mon-Sat, 8:00 AM to 5:00 PM",
};

export const loginActivitySeed = [
  { id: "la-001", device: "Chrome on Windows", ip: "203.177.51.49", date: "2026-04-27T02:02:00Z" },
  { id: "la-002", device: "Safari on iPhone", ip: "120.29.88.14", date: "2026-04-25T12:44:00Z" },
  { id: "la-003", device: "Chrome on Mac", ip: "203.118.81.77", date: "2026-04-21T07:31:00Z" },
];

export function getProductById(productId: string): ClientProduct | undefined {
  return clientProducts.find((product) => product.id === productId);
}

export function getIndividualBagCount(jbQty: number, sbQty: number): number {
  return jbQty * BAG_EQUIVALENT.JB + sbQty * BAG_EQUIVALENT.SB;
}

export function getSourceUnitPrice(productId: string, source: CatalogSource): number {
  const product = getProductById(productId);
  if (!product) return 0;
  return source === "PORT" ? product.portPricePerBag : product.warehousePricePerBag;
}

export function getOrderSubtotal(productId: string, source: CatalogSource, totalIndividualBags: number): number {
  const unitPrice = getSourceUnitPrice(productId, source);
  return unitPrice * totalIndividualBags;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}
