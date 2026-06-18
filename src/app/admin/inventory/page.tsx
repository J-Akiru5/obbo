"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { fetchShipments, fetchPurchaseOrders, fetchDeliveryReceipts } from "@/lib/actions/admin-actions";
import { ShipmentsTab } from "./components/shipments-tab";
import { PoListTab } from "./components/po-list-tab";
import { DrListTab } from "./components/dr-list-tab";
import { CostConfigurationTab } from "./components/cost-configuration-tab"; 
import { Shipment, PurchaseOrder, DeliveryReceipt } from "@/lib/types/database";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

function InventoryContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    
    const getNormalizedTab = (tabParam: string | null) => {
        if (!tabParam) return "shipments";
        if (tabParam === "shipment" || tabParam === "shipment-batches") return "shipments";
        if (tabParam === "cost" || tabParam === "cost-config") return "cost-config";
        return tabParam;
    };

    const [activeTab, setActiveTab] = useState(getNormalizedTab(searchParams.get("tab")));
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [deliveryReceipts, setDeliveryReceipts] = useState<DeliveryReceipt[]>([]);
    const [loading, setLoading] = useState(true);

    // 🌟 OPTIMIZATION: I-load lang ang data na kailangan ng active tab para mabilis!
    const loadTabSpecificData = useCallback(async (tabName: string) => {
        setLoading(true);
        try {
            if (tabName === "shipments") {
                const s = await fetchShipments();
                setShipments(s as Shipment[]);
            } else if (tabName === "po") {
                const p = await fetchPurchaseOrders();
                setPurchaseOrders(p as PurchaseOrder[]);
            } else if (tabName === "dr") {
                const [d, s, p] = await Promise.all([
                    fetchDeliveryReceipts(),
                    fetchShipments(),
                    fetchPurchaseOrders()
                ]);
                setDeliveryReceipts(d as DeliveryReceipt[]);
                setShipments(s as Shipment[]);
                setPurchaseOrders(p as PurchaseOrder[]);
            }
        } catch (error) {
            console.error("Error loading tab data:", error);
            toast.error("Failed to update layout data views.");
        } finally {
            setLoading(false);
        }
    }, []);

    // Tumakbo kapag nagbago ang active tab mula sa URL triggers
    useEffect(() => {
        const tab = searchParams.get("tab");
        const normalized = getNormalizedTab(tab);
        setActiveTab(normalized);
        void loadTabSpecificData(normalized);
    }, [searchParams, loadTabSpecificData]);

    // Supabase realtime listener setups
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase
            .channel('admin-inventory-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => void loadTabSpecificData(activeTab))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => void loadTabSpecificData(activeTab))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_receipts' }, () => void loadTabSpecificData(activeTab))
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [activeTab, loadTabSpecificData]);

    const handleTabChange = (val: string) => {
        router.push(`${pathname}?tab=${val}`);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Inventory Management</h2>
                <p className="text-muted-foreground mt-1">Manage shipments, purchase orders, delivery receipts, and warehouse reports.</p>
            </div>

            {/* HIGH OVERRIDE NAVIGATION BUTTONS */}
            <div className="relative z-50 grid w-full grid-cols-4 bg-zinc-100 dark:bg-zinc-900 border p-1 rounded-xl gap-1">
                <button
                    type="button"
                    onClick={() => handleTabChange("shipments")}
                    className={`py-2.5 text-sm font-bold text-center rounded-lg transition-all cursor-pointer ${
                        activeTab === "shipments"
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs border"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Shipment Batches
                </button>
                <button
                    type="button"
                    onClick={() => handleTabChange("po")}
                    className={`py-2.5 text-sm font-bold text-center rounded-lg transition-all cursor-pointer ${
                        activeTab === "po"
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs border"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    PO List
                </button>
                <button
                    type="button"
                    onClick={() => handleTabChange("dr")}
                    className={`py-2.5 text-sm font-bold text-center rounded-lg transition-all cursor-pointer ${
                        activeTab === "dr"
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs border"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    DR List
                </button>
                <button
                    type="button"
                    onClick={() => handleTabChange("cost-config")}
                    className={`py-2.5 text-sm font-bold text-center rounded-lg transition-all cursor-pointer ${
                        activeTab === "cost-config"
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-xs border"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    Cost Configuration
                </button>
            </div>

            {/* CONDITIONAL RENDER VIEWS */}
            <div className="mt-6">
                {activeTab === "shipments" && (
                    <ShipmentsTab shipments={shipments} loading={loading} onReload={() => void loadTabSpecificData("shipments")} />
                )}
                {activeTab === "po" && (
                    <PoListTab purchaseOrders={purchaseOrders} loading={loading} onReload={() => void loadTabSpecificData("po")} />
                )}
                {activeTab === "dr" && (
                    <DrListTab deliveryReceipts={deliveryReceipts} shipments={shipments} purchaseOrders={purchaseOrders} loading={loading} onReload={() => void loadTabSpecificData("dr")} />
                )}
                {activeTab === "cost-config" && (
                    <CostConfigurationTab />
                )}
            </div>
        </div>
    );
}

export default function AdminInventoryPage() {
    return (
        <Suspense fallback={<div className="py-8 text-center text-muted-foreground animate-pulse">Loading inventory...</div>}>
            <InventoryContent />
        </Suspense>
    );
}