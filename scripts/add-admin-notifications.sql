-- ============================================================
-- OBBO iManage — Admin Notification Triggers
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. Admin Notification Trigger Function ───────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_on_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- bypasses RLS
AS $$
DECLARE
  v_admin_id uuid;
  v_title text;
  v_message text;
  v_href text;
  v_severity text := 'info';
BEGIN
  -- A. NEW ORDER PLACED
  IF (TG_OP = 'INSERT' AND TG_TABLE_NAME = 'orders') THEN
    -- Skip if it's a draft
    IF (NEW.order_type = 'draft') THEN
        RETURN NEW;
    END IF;

    v_title := 'New Order Placed 📦';
    v_message := 'A new order has been placed (PO: ' || COALESCE(NEW.po_number, 'N/A') || '). Review and approve it.';
    v_href := '/admin/orders?tab=new';
    v_severity := 'info';

  -- B. CHECK PAYMENT SUBMITTED
  ELSIF (TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'orders') THEN
    IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'awaiting_check') THEN
        v_title := 'Check Payment Submitted 💳';
        v_message := 'Payment details for PO: ' || NEW.po_number || ' have been submitted. Verification required.';
        v_href := '/admin/orders?tab=fulfillment';
        v_severity := 'warning';
    ELSE
        RETURN NEW;
    END IF;

  -- C. KYC SUBMISSION
  ELSIF (TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'profiles') THEN
    IF (OLD.kyc_status IS DISTINCT FROM NEW.kyc_status AND NEW.kyc_status = 'pending_verification') THEN
        v_title := 'New KYC Submission 📝';
        v_message := 'Client ' || COALESCE(NEW.company_name, NEW.full_name) || ' has submitted KYC documents for review.';
        v_href := '/admin/clients?tab=kyc';
        v_severity := 'info';
    ELSE
        RETURN NEW;
    END IF;

  ELSE
    RETURN NEW;
  END IF;

  -- Insert for all admins and warehouse managers
  FOR v_admin_id IN 
    SELECT id FROM public.profiles 
    WHERE role IN ('admin', 'warehouse_manager')
  LOOP
    -- Avoid notifying the person who triggered it if they are an admin (rare but possible)
    -- IF v_admin_id = auth.uid() THEN CONTINUE; END IF;

    INSERT INTO public.notifications (user_id, title, message, href, severity)
    VALUES (v_admin_id, v_title, v_message, v_href, v_severity);
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── 2. Attach Triggers ───────────────────────────────────────

-- Trigger for Orders
DROP TRIGGER IF EXISTS on_order_admin_notify ON public.orders;
CREATE TRIGGER on_order_admin_notify
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_event();

-- Trigger for Profiles (KYC)
DROP TRIGGER IF EXISTS on_kyc_admin_notify ON public.profiles;
CREATE TRIGGER on_kyc_admin_notify
  AFTER UPDATE OF kyc_status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_event();
