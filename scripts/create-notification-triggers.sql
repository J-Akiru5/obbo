-- ============================================================
-- OBBO iManage — Notification Triggers & Realtime
-- Run this ONCE in your Supabase SQL Editor
-- Safe to re-run (idempotent)
-- ============================================================

-- ── 1. Ensure notifications table exists ─────────────────────
-- (safe to run even if the table already exists)
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  message     text NOT NULL,
  href        text,
  severity    text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','success')),
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications: own read"     ON public.notifications;
DROP POLICY IF EXISTS "notifications: own update"   ON public.notifications;
DROP POLICY IF EXISTS "notifications: admin insert" ON public.notifications;
CREATE POLICY "notifications: own read"     ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications: own update"  ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications: admin insert" ON public.notifications FOR INSERT WITH CHECK (public.is_admin());

-- Also add notification_preferences column to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb
  DEFAULT '{"order_approval": true, "payment_required": true, "dispatch": true, "delivery_status": true}'::jsonb;

-- ── 2. Enable Realtime for notifications table ───────────────
-- Allows the client portal to receive live push updates
-- when new notification rows are inserted for a user.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ── 2. Notification trigger function ────────────────────────
-- Fires after any UPDATE on public.orders where the status
-- column actually changed. Inserts a notification row for
-- the affected client.
CREATE OR REPLACE FUNCTION public.notify_client_on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- bypasses RLS so the trigger can always insert
AS $$
DECLARE
  v_title   text;
  v_message text;
  v_severity text;
  v_href    text := '/client/orders';
BEGIN
  -- Only act when the status column actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Map each transition to a notification
  CASE NEW.status
    WHEN 'approved' THEN
      v_title    := 'Order Approved ✓';
      v_message  := 'Your order' || COALESCE(' (PO: ' || NEW.po_number || ')', '') || ' has been approved and is being prepared for dispatch.';
      v_severity := 'success';

    WHEN 'partially_approved' THEN
      v_title    := 'Order Partially Approved';
      v_message  := 'Your order' || COALESCE(' (PO: ' || NEW.po_number || ')', '') || ' was partially approved. Some items may be unavailable — please check your order details.';
      v_severity := 'warning';

    WHEN 'rejected' THEN
      v_title    := 'Order Rejected';
      v_message  := 'Your order' || COALESCE(' (PO: ' || NEW.po_number || ')', '') || ' was rejected.' || COALESCE(' Reason: ' || NEW.rejection_reason, '') || ' Please contact admin for assistance.';
      v_severity := 'warning';

    WHEN 'awaiting_check' THEN
      v_title    := 'Payment Confirmation Required';
      v_message  := 'Your order' || COALESCE(' (PO: ' || NEW.po_number || ')', '') || ' requires check payment confirmation. Please ensure your check details are submitted.';
      v_severity := 'info';

    WHEN 'dispatched' THEN
      v_title    := 'Your Order Is On Its Way 🚚';
      v_message  := 'Your order' || COALESCE(' (PO: ' || NEW.po_number || ')', '') || ' has been dispatched.' || COALESCE(' Driver: ' || NEW.driver_name, '') || COALESCE(' | Plate: ' || NEW.plate_number, '') || '.';
      v_severity := 'success';

    WHEN 'completed' THEN
      v_title    := 'Order Delivered ✓';
      v_message  := 'Your order' || COALESCE(' (PO: ' || NEW.po_number || ')', '') || ' has been marked as delivered. Thank you for your business!';
      v_severity := 'success';

    ELSE
      -- No notification for other statuses (e.g. internal 'pending')
      RETURN NEW;
  END CASE;

  -- Insert the notification for the client
  INSERT INTO public.notifications (user_id, title, message, href, severity, is_read)
  VALUES (NEW.client_id, v_title, v_message, v_href, v_severity, false);

  RETURN NEW;
END;
$$;

-- ── 3. Attach trigger to orders table ───────────────────────
DROP TRIGGER IF EXISTS on_order_status_changed ON public.orders;

CREATE TRIGGER on_order_status_changed
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_on_order_status_change();
