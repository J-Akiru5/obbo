'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchOrders,
  approveOrder,
  rejectOrder,
  finalConfirmCheck,
  dispatchOrder,
  updateTrackingStatus,
  fetchShipments,
} from '@/lib/actions/admin-actions';
import { NewRequestsTab } from './components/new-requests-tab';
import { FulfillmentTab } from './components/fulfillment-tab';
import { TrackingTab } from './components/tracking-tab';
import { OrderHistoryTab } from './components/order-history-tab';
import { Order, Shipment } from '@/lib/types/database';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const supabase = createClient();
  const [role, setRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'new');
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            const userRole = profile?.role || null;
            setRole(userRole);
            if (userRole !== 'warehouse_manager') {
              router.replace('/admin/dashboard');
            }
          });
      }
    });
  }, [router, supabase]);

  const loadData = async () => {
    try {
      const [o, s] = await Promise.all([fetchOrders(), fetchShipments()]);
      setOrders(o as Order[]);
      setShipments(s as Shipment[]);
    } catch (error) {
      console.error('Error loading orders data:', error);
      toast.error('Failed to load orders data.');
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

  const handleApproveOrder = async (
    orderId: string,
    approvedItems: { itemId: string; qty: number }[],
    shippingFee?: number,
  ) => {
    try {
      await approveOrder(orderId, approvedItems, shippingFee);
      toast.success('Order approved successfully.');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to approve order.');
    }
  };

  const handleRejectOrder = async (orderId: string, reason: string) => {
    try {
      await rejectOrder(orderId, reason);
      toast.success('Order rejected.');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to reject order.');
    }
  };

  const handleConfirmCheck = async (orderId: string) => {
    try {
      await finalConfirmCheck(orderId);
      toast.success('Check payment confirmed.');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to confirm check.');
    }
  };

  const handleDispatch = async (
    orderId: string,
    shipmentId: string,
    drNumber: string,
    drImageUrl: string | null,
    driverName: string | null,
    plateNumber: string | null,
  ) => {
    try {
      await dispatchOrder(orderId, shipmentId, drNumber, drImageUrl, driverName, plateNumber);
      toast.success('Order dispatched successfully.');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to dispatch order.');
    }
  };

  const handleTrackingUpdate = async (
    orderId: string,
    status: string,
    jbReturned?: number,
    sbReturned?: number,
    reason?: string,
  ) => {
    try {
      await updateTrackingStatus(orderId, status, jbReturned, sbReturned, reason);
      toast.success('Tracking status updated.');
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update tracking.');
    }
  };

  if (role !== 'warehouse_manager') {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Order Management</h2>
        <p className="text-muted-foreground mt-1">
          Manage the complete lifecycle of client orders.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="no-scrollbar mb-4 flex h-auto w-full justify-start overflow-x-auto rounded-none border-b pb-1 md:mb-0 md:grid md:grid-cols-4 md:rounded-md md:border-b-0 md:pb-0">
          <TabsTrigger value="new" className="shrink-0 py-2.5 whitespace-nowrap">
            New Requests
            {orders.filter(
              (o) => o.status === 'pending' || o.status === 'pending_final_confirmation',
            ).length > 0 && (
              <span className="bg-accent text-accent-foreground ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                {
                  orders.filter(
                    (o) => o.status === 'pending' || o.status === 'pending_final_confirmation',
                  ).length
                }
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fulfillment" className="shrink-0 py-2.5 whitespace-nowrap">
            Fulfillment
          </TabsTrigger>
          <TabsTrigger value="tracking" className="shrink-0 py-2.5 whitespace-nowrap">
            Tracking
          </TabsTrigger>
          <TabsTrigger value="history" className="shrink-0 py-2.5 whitespace-nowrap">
            History
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="new">
            <NewRequestsTab
              orders={orders.filter(
                (o) =>
                  o.status === 'pending' ||
                  o.status === 'pending_final_confirmation' ||
                  o.status === 'awaiting_check',
              )}
              onApprove={handleApproveOrder}
              onReject={handleRejectOrder}
              onConfirmCheck={handleConfirmCheck}
              loading={loading}
            />
          </TabsContent>

          <TabsContent value="fulfillment">
            <FulfillmentTab
              orders={orders.filter(
                (o) => o.status === 'approved' || o.status === 'partially_approved',
              )}
              shipments={shipments}
              onDispatch={handleDispatch}
              loading={loading}
            />
          </TabsContent>

          <TabsContent value="tracking">
            <TrackingTab
              orders={orders.filter((o) => o.status === 'dispatched')}
              onUpdateTracking={handleTrackingUpdate}
              loading={loading}
            />
          </TabsContent>

          <TabsContent value="history">
            <OrderHistoryTab orders={orders} loading={loading} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground animate-pulse py-8 text-center">
          Loading orders...
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
