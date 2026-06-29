import { fetchClientOrders, fetchDraftOrders } from '@/lib/actions/client-actions';
import OrdersClient from './components/orders-client';

export const metadata = {
  title: 'My Orders | OBBO iManage',
};

export default async function ClientOrdersPage() {
  const [orders, drafts] = await Promise.all([fetchClientOrders(), fetchDraftOrders()]);

  return <OrdersClient orders={orders} drafts={drafts} />;
}
