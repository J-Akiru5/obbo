'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, ChevronLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useClientKyc } from '@/lib/context/client-kyc-context';
import { usePersistedForm } from '@/lib/hooks/use-persisted-form';
import { StepIndicator } from '@/components/ui/step-indicator';
import { StepProducts } from '@/components/orders/wizard/step-products';
import { StepSource } from '@/components/orders/wizard/step-source';
import { StepServiceType } from '@/components/orders/wizard/step-service-type';
import { StepPoPayment } from '@/components/orders/wizard/step-po-payment';
import { StepOrderReview } from '@/components/orders/wizard/step-review';
import {
  productsSchema,
  sourceSchema,
  serviceTypeSchema,
  poPaymentSchema,
  getSplitSchema,
  getPrice,
  getSubtotalByBagType,
  getSplitDeliveryUnits,
  getTotalIndividualBags,
  bgsToUnits,
  unitsToBags,
} from '@/components/orders/wizard/order-schema';
import {
  submitOrder,
  saveOrderDraft,
  generateNextPoNumber,
  fetchOrderForResume,
} from '@/lib/actions/client-actions';
import type { Product, OrderItem } from '@/lib/types/database';

const ORDERING_STEPS = ['Products', 'Source', 'Service', 'PO & Payment', 'Review'];

// jb_bags/sb_bags are individual bags as typed by the client — the wizard
// converts these to whole JB/SB units (via bgsToUnits, rounding up) at every
// point that needs a unit count for pricing/submission. See order-schema.ts.
const INITIAL_FORM = {
  jb_bags: 0,
  sb_bags: 0,
  source: 'warehouse' as 'port' | 'warehouse',
  service_type: 'pickup' as 'pickup' | 'deliver',
  driver_name: '',
  plate_number: '',
  preferred_pickup_date: '',
  po_number: '',
  payment_method: 'cash' as 'cash' | 'check',
  wants_split: false,
  deliver_now_total: 0,
};

export default function NewOrderPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground animate-pulse py-8 text-center">
          Loading order form...
        </div>
      }
    >
      <NewOrderPage />
    </Suspense>
  );
}

function NewOrderPage() {
  const router = useRouter();
  const { kycStatus } = useClientKyc();
  const isVerified = kycStatus === 'verified';

  // Bumped from 'obbo-order-form': the persisted shape changed (jb_qty/sb_qty
  // -> jb_bags/sb_bags), so an in-progress draft sitting in a client's
  // sessionStorage from before this deploy misses under the new key and
  // falls back to INITIAL_FORM cleanly, instead of resuming mid-wizard with
  // zeroed-out quantities under stale field names.
  const FORM_STORAGE_KEY = 'obbo-order-form-v2';
  const [form, updateForm, clearForm] = usePersistedForm(FORM_STORAGE_KEY, INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed._orderingStep ?? 0;
      }
    } catch {
      /* ignore */
    }
    return 0;
  });
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(parsed._orderingCompleted ?? []);
      }
    } catch {
      /* ignore */
    }
    return new Set();
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);

  const [poFile, setPoFile] = useState<File | null>(null);

  // Derived, not persisted: the rounded-up unit counts that pricing,
  // submission, and every downstream step actually operate on. A client
  // entering 75 individual SB bags needs 2 SB units billed (100 actual
  // bags) — see bgsToUnits in order-schema.ts.
  const jbUnits = bgsToUnits(form.jb_bags, 'JB');
  const sbUnits = bgsToUnits(form.sb_bags, 'SB');

  useEffect(() => {
    createClient()
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setProducts(data ?? []);
        setLoadingProducts(false);
      });
  }, []);

  // Auto-generate PO number on mount
  useEffect(() => {
    if (!form.po_number) {
      generateNextPoNumber().then((po) => {
        updateForm({ po_number: po });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume from draft if ?draft= param is present
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft');
  const bagType = searchParams.get('bag_type') as 'JB' | 'SB' | null;
  useEffect(() => {
    if (!draftId) return;

    let cancelled = false;
    fetchOrderForResume(draftId)
      .then((draft) => {
        if (cancelled) return;

        const jbItem = draft.items?.find((i: OrderItem) => i.bag_type === 'JB');
        const sbItem = draft.items?.find((i: OrderItem) => i.bag_type === 'SB');

        updateForm({
          // Stored quantities are JB/SB UNITS; convert back to the individual
          // bags the wizard now collects. This round-trips exactly for whole
          // unit counts (units -> bags -> bgsToUnits never rounds up an exact
          // multiple), so resuming a draft loses no precision.
          jb_bags: unitsToBags(jbItem?.requested_qty || 0, 'JB'),
          sb_bags: unitsToBags(sbItem?.requested_qty || 0, 'SB'),
          source: draft.source || 'warehouse',
          service_type: draft.service_type || 'pickup',
          driver_name: draft.driver_name || '',
          plate_number: draft.plate_number || '',
          preferred_pickup_date: draft.preferred_pickup_date || '',
          po_number: draft.po_number || '',
          payment_method: draft.payment_method || 'cash',
          wants_split: draft.is_split_delivery || false,
          deliver_now_total: (draft.deliver_now_jb || 0) * 25 + (draft.deliver_now_sb || 0) * 50,
        } as Partial<typeof INITIAL_FORM>);

        // Jump to Review step
        setCurrentStep(4);
        setCompletedSteps(new Set([0, 1, 2, 3]));
      })
      .catch(() => {
        toast.error('Failed to load draft. It may have been deleted.');
        router.push('/client/orders');
      });

    return () => {
      cancelled = true;
    };
  }, [draftId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist wizard navigation state back to sessionStorage
  useEffect(() => {
    updateForm({
      _orderingStep: currentStep,
      _orderingCompleted: Array.from(completedSteps),
    } as Partial<typeof INITIAL_FORM>);
  }, [currentStep, completedSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = useCallback(
    (field: string, value: string | boolean | number) => {
      updateForm({ [field]: value } as Partial<typeof INITIAL_FORM>);
      setErrors((prev) => {
        if (prev[field]) {
          const next = { ...prev };
          delete next[field];
          return next;
        }
        return prev;
      });
    },
    [updateForm],
  );

  function validateStep(step: number): boolean {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      // productsSchema's "at least 1 bag" check is denomination-agnostic —
      // bags > 0 iff the derived units are > 0 — so validating on the raw
      // bag input the client actually typed gives a more direct error.
      const result = productsSchema.safeParse({ jb_qty: form.jb_bags, sb_qty: form.sb_bags });
      if (!result.success) {
        for (const issue of result.error.issues) {
          newErrors[issue.path[0] as string] = issue.message;
        }
      }
    }

    if (step === 1) {
      const result = sourceSchema.safeParse({ source: form.source });
      if (!result.success) {
        for (const issue of result.error.issues) {
          newErrors[issue.path[0] as string] = issue.message;
        }
      }
    }

    if (step === 2) {
      const result = serviceTypeSchema.safeParse({
        service_type: form.service_type,
        driver_name: form.driver_name,
        plate_number: form.plate_number,
        preferred_pickup_date: form.preferred_pickup_date,
      });
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = issue.path[0] as string;
          if (!newErrors[key]) newErrors[key] = issue.message;
        }
      }
    }

    if (step === 3) {
      const result = poPaymentSchema.safeParse({
        po_number: form.po_number,
        po_file: poFile,
        payment_method: form.payment_method,
        wants_split: form.wants_split,
        deliver_now_total: form.deliver_now_total,
      });
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = issue.path[0] as string;
          if (!newErrors[key]) newErrors[key] = issue.message;
        }
      }
      if (form.wants_split) {
        const totalBags = getTotalIndividualBags(jbUnits, sbUnits);
        const splitResult = getSplitSchema(totalBags).safeParse({
          wants_split: form.wants_split,
          deliver_now_total: form.deliver_now_total,
        });
        if (!splitResult.success) {
          for (const issue of splitResult.error.issues) {
            const key = issue.path[0] as string;
            if (!newErrors[key]) newErrors[key] = issue.message;
          }
        }
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const msgs = Object.values(newErrors);
      toast.error(
        msgs.length <= 2
          ? msgs.join('. ')
          : `${msgs[0]} — and ${msgs.length - 1} more issue${msgs.length > 2 ? 's' : ''}.`,
      );
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateStep(currentStep)) return;
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    setCurrentStep((s: number) => Math.min(s + 1, ORDERING_STEPS.length - 1));
    setErrors({});
  }

  function goBack() {
    if (currentStep === 0) {
      router.push('/client/orders');
      return;
    }
    setCurrentStep((s: number) => Math.max(s - 1, 0));
    setErrors({});
  }

  function goToStep(step: number) {
    if (step < currentStep || completedSteps.has(step)) {
      setCurrentStep(step);
      setErrors({});
    }
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  async function uploadFile(file: File, prefix: string): Promise<string> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File exceeds the 10MB size limit. Please use a smaller file.`);
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const path = `${user.id}/${prefix}_${timestamp}_${randomId}.${ext}`;

    const { error } = await supabase.storage
      .from('order-attachments')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from('order-attachments').getPublicUrl(path);
    return publicUrl;
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      if (!poFile) {
        toast.error('PO image is required.');
        return;
      }

      const poImageUrl = await uploadFile(poFile, 'po');

      const jbProduct = products.find((p) => p.bag_type === 'JB');
      const sbProduct = products.find((p) => p.bag_type === 'SB');
      const jbPrice = getPrice(jbProduct, form.source);
      const sbPrice = getPrice(sbProduct, form.source);

      const jbQty = jbUnits;
      const sbQty = sbUnits;

      const items: { product_id: string; bag_type: string; requested_qty: number }[] = [];
      if (jbQty > 0 && jbProduct) {
        items.push({ product_id: jbProduct.id, bag_type: 'JB', requested_qty: jbQty });
      }
      if (sbQty > 0 && sbProduct) {
        items.push({ product_id: sbProduct.id, bag_type: 'SB', requested_qty: sbQty });
      }

      const subtotal = getSubtotalByBagType(jbQty, sbQty, jbPrice, sbPrice);

      let notes = '';
      if (form.service_type === 'pickup' && form.preferred_pickup_date) {
        notes = `Preferred Pick-up Date: ${form.preferred_pickup_date}`;
      }

      const orderData = {
        source: form.source,
        service_type: form.service_type,
        payment_method: form.payment_method,
        po_number: form.po_number,
        po_image_url: poImageUrl,
        supplier_name: 'OBBO',
        driver_name: form.service_type === 'pickup' ? form.driver_name : null,
        plate_number: form.service_type === 'pickup' ? form.plate_number : null,
        preferred_pickup_date:
          form.service_type === 'pickup' ? form.preferred_pickup_date : undefined,
        total_amount: subtotal,
        items,
        notes: notes.trim(),
      };

      const totalBagsForSplit = getTotalIndividualBags(jbQty, sbQty);
      const deliverNowQty = form.deliver_now_total;
      // deliverNowQty is individual bags; deliverNowJB/SB must be whole units.
      const { deliverNowJB, deliverNowSB } = getSplitDeliveryUnits(jbQty, sbQty, deliverNowQty);
      const splitDetails = form.wants_split
        ? {
            wantsSplit: true,
            deliverNowQty,
            deliverNowJB,
            deliverNowSB,
            splitNote: `Client requested ${deliverNowQty} bags now (${deliverNowJB} JB, ${deliverNowSB} SB) of ${totalBagsForSplit} total. Service: ${form.service_type}.`,
          }
        : undefined;

      const result = await submitOrder(orderData, splitDetails);
      if (!result.success) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      toast.success('Order submitted successfully! Pending approval.');
      clearForm();
      router.push('/client/orders');
    } catch (err) {
      // Genuinely unexpected errors (network failure, etc.) still land here —
      // submitOrder's own validation/business-rule errors no longer do.
      const msg = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    setDraftLoading(true);
    try {
      if (!poFile && !form.po_number) {
        toast.error('At least a PO number is required for a draft.');
        return;
      }

      let poImageUrl: string | undefined;
      if (poFile) {
        poImageUrl = await uploadFile(poFile, 'po');
      }

      const jbProduct = products.find((p) => p.bag_type === 'JB');
      const sbProduct = products.find((p) => p.bag_type === 'SB');
      const jbPrice = getPrice(jbProduct, form.source);
      const sbPrice = getPrice(sbProduct, form.source);

      const jbQty = jbUnits;
      const sbQty = sbUnits;

      const items: { product_id: string; bag_type: string; requested_qty: number }[] = [];
      if (jbQty > 0 && jbProduct) {
        items.push({ product_id: jbProduct.id, bag_type: 'JB', requested_qty: jbQty });
      }
      if (sbQty > 0 && sbProduct) {
        items.push({ product_id: sbProduct.id, bag_type: 'SB', requested_qty: sbQty });
      }

      const subtotal = getSubtotalByBagType(jbQty, sbQty, jbPrice, sbPrice);

      const orderData = {
        source: form.source,
        service_type: form.service_type,
        payment_method: form.payment_method,
        po_number: form.po_number,
        po_image_url: poImageUrl,
        supplier_name: 'OBBO',
        driver_name: form.service_type === 'pickup' ? form.driver_name : null,
        plate_number: form.service_type === 'pickup' ? form.plate_number : null,
        preferred_pickup_date:
          form.service_type === 'pickup' ? form.preferred_pickup_date : undefined,
        total_amount: subtotal,
        items,
        notes: '',
      };

      // deliver_now_total is individual bags; deliverNowJB/SB must be whole units.
      const { deliverNowJB: dNowJB, deliverNowSB: dNowSB } = getSplitDeliveryUnits(
        jbQty,
        sbQty,
        form.deliver_now_total,
      );
      const splitDetails = form.wants_split
        ? {
            wantsSplit: true,
            deliverNowQty: form.deliver_now_total,
            deliverNowJB: dNowJB,
            deliverNowSB: dNowSB,
          }
        : undefined;
      const result = await saveOrderDraft(orderData, splitDetails);
      if (!result.success) {
        toast.error(result.error);
        setDraftLoading(false);
        return;
      }

      toast.success('Order saved as draft.');
      clearForm();
      router.push('/client/orders');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save draft.';
      toast.error(msg);
    } finally {
      setDraftLoading(false);
    }
  }

  if (!isVerified) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
        <h2 className="text-foreground text-xl font-bold">Verification Required</h2>
        <p className="text-muted-foreground">
          You need to be KYC verified before you can place orders.
        </p>
        <Link href="/client/pending-kyc">
          <Button variant="outline">Learn more</Button>
        </Link>
      </div>
    );
  }

  if (loadingProducts) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading products...</p>
      </div>
    );
  }

  const isReviewStep = currentStep === ORDERING_STEPS.length - 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Place New Order</h2>
        <p className="text-muted-foreground mt-1">
          Select your products, source, and service type to proceed.
        </p>
      </div>

      <StepIndicator
        steps={ORDERING_STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={goToStep}
      />

      <div className="relative overflow-hidden">
        <div key={currentStep} className="animate-slide-in-right">
          {currentStep === 0 && (
            <StepProducts
              jbBags={form.jb_bags}
              sbBags={form.sb_bags}
              onJbChange={(value) => updateField('jb_bags', value)}
              onSbChange={(value) => updateField('sb_bags', value)}
              bagType={bagType}
              error={errors.jb_qty}
            />
          )}
          {currentStep === 1 && (
            <StepSource
              value={form.source}
              onChange={(v) => updateField('source', v)}
              products={products}
              jbQty={jbUnits}
              sbQty={sbUnits}
              error={errors.source}
            />
          )}
          {currentStep === 2 && (
            <StepServiceType
              value={form.service_type}
              onChange={(v) => updateField('service_type', v)}
              driverName={form.driver_name}
              plateNumber={form.plate_number}
              pickupDate={form.preferred_pickup_date}
              onFieldChange={updateField}
              errors={errors}
            />
          )}
          {currentStep === 3 && (
            <StepPoPayment
              form={form}
              files={{ po_file: poFile }}
              onFieldChange={updateField}
              onFileChange={(_field, file) => setPoFile(file)}
              errors={errors}
              totalBags={getTotalIndividualBags(jbUnits, sbUnits)}
            />
          )}
          {currentStep === 4 && (
            <StepOrderReview
              form={{ ...form, jb_qty: jbUnits, sb_qty: sbUnits }}
              files={{ po_file: poFile }}
              products={products}
              onEditStep={goToStep}
              onSubmit={handleSubmit}
              onSaveDraft={handleSaveDraft}
              loading={loading}
              draftLoading={draftLoading}
            />
          )}
        </div>
      </div>

      {/* Navigation — hidden on review step */}
      {!isReviewStep && (
        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" className="h-11 gap-1" onClick={goBack}>
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 0 ? 'Back to Orders' : 'Back'}
          </Button>
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 gap-2 font-semibold"
            onClick={goNext}
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Back button on review step */}
      {isReviewStep && (
        <div className="flex justify-start">
          <Button type="button" variant="outline" className="h-11 gap-1" onClick={goBack}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
