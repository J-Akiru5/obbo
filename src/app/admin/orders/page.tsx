"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchOrders, fetchProducts, updateProduct, approveOrder, rejectOrder, finalConfirmCheck, dispatchOrder, updateTrackingStatus, fetchShipments } from "@/lib/actions/admin-actions";
import { ProductCatalogTab } from "./components/product-catalog-tab";
import { NewRequestsTab } from "./components/new-requests-tab";
import { FulfillmentTab } from "./components/fulfillment-tab";
import { TrackingTab } from "./components/tracking-tab";
import { OrderHistoryTab } from "./components/order-history-tab";
import { Order, Product, Shipment } from "@/lib/types/database";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

function OrdersContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "new");
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const [o, p, s] = await Promise.all([
                fetchOrders(),
                fetchProducts(),
                fetchShipments()
            ]);
            setOrders(o as Order[]);
            setProducts(p as Product[]);
            setShipments(s as Shipment[]);
        } catch (error) {
            console.error("Error loading orders data:", error);
            toast.error("Failed to load orders data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams, activeTab]);

    useEffect(() => {
        loadData();

        const supabase = createClient();
        const channel = supabase
            .channel('admin-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                loadData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
                loadData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleTabChange = (val: string) => {
        setActiveTab(val);
        router.push(`${pathname}?tab=${val}`);
    };

    const handleProductUpdate = async (id: string, updates: any) => {
        try {
            await updateProduct(id, updates);
            toast.success("Product updated successfully.");
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Failed to update product.");
        }
    };

    const handleApproveOrder = async (orderId: string, approvedItems: { itemId: string; qty: number }[], shippingFee?: number) => {
        try {
            await approveOrder(orderId, approvedItems, shippingFee);
            toast.success("Order approved successfully.");
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Failed to approve order.");
        }
    };

    const handleRejectOrder = async (orderId: string, reason: string) => {
        try {
            await rejectOrder(orderId, reason);
            toast.success("Order rejected.");
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Failed to reject order.");
        }
    };

    const handleConfirmCheck = async (orderId: string) => {
        try {
            await finalConfirmCheck(orderId);
            toast.success("Check payment confirmed.");
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Failed to confirm check.");
        }
    };

    const handleDispatch = async (orderId: string, shipmentId: string, drNumber: string, drImageUrl: string | null, driverName: string | null, plateNumber: string | null) => {
        try {
            await dispatchOrder(orderId, shipmentId, drNumber, drImageUrl, driverName, plateNumber);
            toast.success("Order dispatched successfully.");
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Failed to dispatch order.");
        }
    };

    const handleTrackingUpdate = async (orderId: string, status: string, jbReturned?: number, sbReturned?: number) => {
        try {
            await updateTrackingStatus(orderId, status, jbReturned, sbReturned);
            toast.success("Tracking status updated.");
            loadData();
        } catch (e: any) {
            toast.error(e.message || "Failed to update tracking.");
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Order Management</h2>
                <p className="text-muted-foreground mt-1">Manage the complete lifecycle of client orders.</p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-auto">
                    <TabsTrigger value="catalog" className="py-2.5">Products</TabsTrigger>
                    <TabsTrigger value="new" className="py-2.5">
                        New Requests
                        {orders.filter(o => o.status === "pending").length > 0 && (
                            <span className="ml-2 bg-[var(--color-industrial-yellow)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {orders.filter(o => o.status === "pending").length}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="fulfillment" className="py-2.5">Fulfillment</TabsTrigger>
                    <TabsTrigger value="tracking" className="py-2.5">Tracking</TabsTrigger>
                    <TabsTrigger value="history" className="py-2.5">History</TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="catalog">
                        <ProductCatalogTab products={products} onUpdate={handleProductUpdate} loading={loading} />
                    </TabsContent>
                    
                    <TabsContent value="new">
                        <NewRequestsTab 
                            orders={orders.filter(o => o.status === "pending")} 
                            onApprove={handleApproveOrder} 
                            onReject={handleRejectOrder}
                            loading={loading}
                        />
                    </TabsContent>

                    <TabsContent value="fulfillment">
                        <FulfillmentTab 
                            orders={orders.filter(o => o.status === "approved" || o.status === "partially_approved" || o.status === "awaiting_check")}
                            shipments={shipments}
                            onDispatch={handleDispatch}
                            onConfirmCheck={handleConfirmCheck}
                            loading={loading}
                        />
                    </TabsContent>

                    <TabsContent value="tracking">
                        <TrackingTab 
                            orders={orders.filter(o => o.status === "dispatched")}
                            onUpdateTracking={handleTrackingUpdate}
                            loading={loading}
                        />
                    </TabsContent>

                    <TabsContent value="history">
                        <OrderHistoryTab 
                            orders={orders.filter(o => o.status === "completed" || o.status === "rejected")}
                            loading={loading}
                        />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}

export default function AdminOrdersPage() {
    return (
        <Suspense fallback={<div className="py-8 text-center text-muted-foreground animate-pulse">Loading orders...</div>}>
            <OrdersContent />
        </Suspense>
    );
}
