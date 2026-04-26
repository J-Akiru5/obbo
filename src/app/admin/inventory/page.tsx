"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchShipments, fetchPurchaseOrders, fetchDeliveryReceipts, fetchWarehouseReport } from "@/lib/actions/admin-actions";
import { ShipmentsTab } from "./components/shipments-tab";
import { PoListTab } from "./components/po-list-tab";
import { DrListTab } from "./components/dr-list-tab";
import { ReportsTab } from "./components/reports-tab";
import { Shipment, PurchaseOrder, DeliveryReceipt, WarehouseReport } from "@/lib/types/database";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function AdminInventoryPage() {
    const [activeTab, setActiveTab] = useState("shipments");
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [deliveryReceipts, setDeliveryReceipts] = useState<DeliveryReceipt[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const [s, p, d] = await Promise.all([
                fetchShipments(),
                fetchPurchaseOrders(),
                fetchDeliveryReceipts()
            ]);
            setShipments(s as Shipment[]);
            setPurchaseOrders(p as PurchaseOrder[]);
            setDeliveryReceipts(d as DeliveryReceipt[]);
        } catch (error) {
            console.error("Error loading inventory data:", error);
            toast.error("Failed to load inventory data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        const supabase = createClient();
        const channel = supabase
            .channel('admin-inventory')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shipment_ledger' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_receipts' }, () => loadData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Inventory Management</h2>
                <p className="text-muted-foreground mt-1">Manage shipments, purchase orders, delivery receipts, and warehouse reports.</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-auto">
                    <TabsTrigger value="shipments" className="py-2.5">Shipment Batches</TabsTrigger>
                    <TabsTrigger value="po" className="py-2.5">PO List</TabsTrigger>
                    <TabsTrigger value="dr" className="py-2.5">DR List</TabsTrigger>
                    <TabsTrigger value="reports" className="py-2.5">Warehouse Reports</TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="shipments">
                        <ShipmentsTab shipments={shipments} loading={loading} onReload={loadData} />
                    </TabsContent>
                    
                    <TabsContent value="po">
                        <PoListTab purchaseOrders={purchaseOrders} loading={loading} onReload={loadData} />
                    </TabsContent>

                    <TabsContent value="dr">
                        <DrListTab deliveryReceipts={deliveryReceipts} shipments={shipments} loading={loading} onReload={loadData} />
                    </TabsContent>

                    <TabsContent value="reports">
                        <ReportsTab />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
