'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchShipments,
  fetchPurchaseOrders,
  fetchDeliveryReceipts,
} from '@/lib/actions/admin-actions';
import { ShipmentsTab } from './components/shipments-tab';
import { PoListTab } from './components/po-list-tab';
import { DrListTab } from './components/dr-list-tab';
import { Shipment, PurchaseOrder, DeliveryReceipt } from '@/lib/types/database';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

function InventoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'shipments');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [deliveryReceipts, setDeliveryReceipts] = useState<DeliveryReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  const DEMO_MODE = false;

  const loadData = async () => {
    if (DEMO_MODE) {
      setShipments([]);
      setPurchaseOrders([]);
      setDeliveryReceipts([]);
      setLoading(false);
      return;
    }
    try {
      const [s, p, d] = await Promise.all([
        fetchShipments(),
        fetchPurchaseOrders(),
        fetchDeliveryReceipts(),
      ]);
      setShipments(s as Shipment[]);
      setPurchaseOrders(p as PurchaseOrder[]);
      setDeliveryReceipts(d as DeliveryReceipt[]);
    } catch (error) {
      console.error('Error loading inventory data:', error);
      toast.error('Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  useEffect(() => {
    loadData();

    const supabase = createClient();
    const channel = supabase
      .channel('admin-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () =>
        loadData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipment_ledger' }, () =>
        loadData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () =>
        loadData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_receipts' }, () =>
        loadData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    router.push(`${pathname}?tab=${val}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Inventory Management</h2>
        <p className="text-muted-foreground mt-1">
          Manage shipments, purchase orders, delivery receipts, and warehouse reports.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="no-scrollbar mb-4 flex h-auto w-full justify-start overflow-x-auto rounded-none border-b pb-1 md:mb-0 md:grid md:grid-cols-3 md:rounded-md md:border-b-0 md:pb-0">
          <TabsTrigger value="shipments" className="shrink-0 py-2.5 whitespace-nowrap">
            Shipment Batches
          </TabsTrigger>
          <TabsTrigger value="po" className="shrink-0 py-2.5 whitespace-nowrap">
            PO List
          </TabsTrigger>
          <TabsTrigger value="dr" className="shrink-0 py-2.5 whitespace-nowrap">
            DR List
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="shipments">
            <ShipmentsTab shipments={shipments} loading={loading} onReload={loadData} />
          </TabsContent>

          <TabsContent value="po">
            <PoListTab purchaseOrders={purchaseOrders} loading={loading} onReload={loadData} />
          </TabsContent>

          <TabsContent value="dr">
            <DrListTab
              deliveryReceipts={deliveryReceipts}
              shipments={shipments}
              purchaseOrders={purchaseOrders}
              loading={loading}
              onReload={loadData}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function AdminInventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground animate-pulse py-8 text-center">
          Loading inventory...
        </div>
      }
    >
      <InventoryContent />
    </Suspense>
  );
}
