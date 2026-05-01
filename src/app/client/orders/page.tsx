import { fetchClientOrders } from "@/lib/actions/client-actions";
import OrdersClient from "./components/orders-client";

export const metadata = {
    title: "My Orders | OBBO iManage",
};

export default async function ClientOrdersPage() {
    const orders = await fetchClientOrders();

    return <OrdersClient orders={orders} />;
}
