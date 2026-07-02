import { productHandlers } from './products';
import { orderHandlers } from './orders';
import { orderItemHandlers } from './order-items';
import { shipmentHandlers, shipmentLedgerHandlers } from './shipments';
import { profileHandlers } from './profiles';
import { authHandlers } from './auth';
import { purchaseOrderHandlers } from './purchase-orders';
import { deliveryReceiptHandlers } from './delivery-receipts';
import { adminSettingHandlers } from './admin-settings';
import { customerBalanceHandlers } from './customer-balances';

export const handlers = [
  ...authHandlers,
  ...profileHandlers,
  ...productHandlers,
  ...orderHandlers,
  ...orderItemHandlers,
  ...shipmentHandlers,
  ...shipmentLedgerHandlers,
  ...purchaseOrderHandlers,
  ...deliveryReceiptHandlers,
  ...adminSettingHandlers,
  ...customerBalanceHandlers,
];
