'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BellOff, CheckCircle2, AlertCircle, Info, ChevronLeft, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Notification } from '@/lib/types/database';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(data ?? []);
      setUnreadCount(count ?? 0);
    } catch {
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Failed to mark all as read.');
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      try {
        const supabase = createClient();
        await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);

        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)),
        );
      } catch {
        // silently fail
      }
    }
    router.push(n.href || '/client/orders');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      {/* Header toolbar */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Notifications</h2>
            <p className="text-muted-foreground text-xs">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'No unread notifications'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Check className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground py-20 text-center">
          <p className="animate-pulse">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="border-border bg-card rounded-xl border border-dashed py-24 text-center">
          <BellOff className="text-muted-foreground/30 mx-auto mb-3 h-10 w-10" />
          <h3 className="text-foreground text-sm font-semibold">No notifications yet</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            We will notify you here when your orders update.
          </p>
        </div>
      ) : (
        <div className="divide-border/60 bg-card divide-y overflow-hidden rounded-xl border">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`hover:bg-muted/30 flex cursor-pointer items-start gap-4 p-4 transition-colors ${
                !n.is_read ? 'bg-primary/5' : ''
              }`}
            >
              {/* Severity Icon */}
              <div className="mt-0.5">
                {n.severity === 'warning' ? (
                  <div className="rounded-lg bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                ) : n.severity === 'success' ? (
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <Info className="h-4 w-4" />
                  </div>
                )}
              </div>

              {/* Notification Content */}
              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <p
                    className={`text-sm ${!n.is_read ? 'text-foreground font-bold' : 'text-muted-foreground'}`}
                  >
                    {n.title}
                  </p>
                  {!n.is_read && (
                    <span className="bg-primary mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                  )}
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">{n.message}</p>
                <p className="text-muted-foreground/60 text-[10px]">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
