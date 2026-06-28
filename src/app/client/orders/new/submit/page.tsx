'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useClientKyc } from '@/lib/context/client-kyc-context';
import { usePersistedForm } from '@/lib/hooks/use-persisted-form';
import { StepIndicator } from '@/components/ui/step-indicator';
import { StepPoPayment } from '@/components/orders/wizard/step-po-payment';
import { StepOrderReview } from '@/components/orders/wizard/step-review';
import { submitOrder, saveOrderDraft, generateNextPoNumber } from '@/lib/actions/client-actions';
import { poPaymentSchema, getSplitSchema } from '@/components/orders/wizard/order-schema';
import type { Product } from '@/lib/types/database';

const SUBMIT_STEPS = ['PO & Payment', 'Review'];

const INITIAL_FORM = {
  jb_qty: 0,
  sb_qty: 0,
  source: 'warehouse' as 'port' | 'warehouse',
  service_type: 'pickup' as 'pickup' | 'deliver',
  driver_name: '',
  plate_number: '',
  preferred_pickup_date: '',
  po_number: '',
  supplier_name: 'OBBO',
  payment_method: 'cash' as 'cash' | 'check',
  wants_split: false,
  deliver_now_jb: 0,
  deliver_now_sb: 0,
};

export default function SubmitOrderPage() {
  const router = useRouter();
  const { kycStatus } = useClientKyc();
  const isVerified = kycStatus === 'verified';

  const [form, updateForm, clearForm] = usePersistedForm('obbo-order-form', INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [poFile, setPoFile] = useState<File | null>(null);
  const [checkFile, setCheckFile] = useState<File | null>(null);

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
      const result = poPaymentSchema.safeParse({
        po_number: form.po_number,
        po_file: poFile,
        supplier_name: form.supplier_name,
        payment_method: form.payment_method,
        check_file: checkFile,
        wants_split: form.wants_split,
        deliver_now_jb: form.deliver_now_jb,
        deliver_now_sb: form.deliver_now_sb,
      });
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = issue.path[0] as string;
          if (!newErrors[key]) newErrors[key] = issue.message;
        }
      }
      if (form.wants_split) {
        const splitResult = getSplitSchema(form.jb_qty, form.sb_qty).safeParse({
          wants_split: form.wants_split,
          deliver_now_jb: form.deliver_now_jb,
          deliver_now_sb: form.deliver_now_sb,
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
      toast.error('Please fix the errors before continuing.');
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateStep(currentStep)) return;
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    setCurrentStep((s) => Math.min(s + 1, SUBMIT_STEPS.length - 1));
    setErrors({});
  }

  function goBack() {
    if (currentStep === 0) {
      router.push('/client/orders/new');
      return;
    }
    setCurrentStep((s) => Math.max(s - 1, 0));
    setErrors({});
  }

  function goToStep(step: number) {
    if (step < currentStep || completedSteps.has(step)) {
      setCurrentStep(step);
      setErrors({});
    }
  }

  async function uploadFile(file: File, prefix: string): Promise<string> {
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

      let checkImageUrl: string | null = null;
      if (form.payment_method === 'check' && checkFile) {
        checkImageUrl = await uploadFile(checkFile, 'check');
      }

      const items: { product_id: string; bag_type: string; requested_qty: number }[] = [];
      const jbProduct = products.find((p) => p.bag_type === 'JB');
      const sbProduct = products.find((p) => p.bag_type === 'SB');

      if (form.jb_qty > 0 && jbProduct) {
        items.push({ product_id: jbProduct.id, bag_type: 'JB', requested_qty: form.jb_qty });
      }
      if (form.sb_qty > 0 && sbProduct) {
        items.push({ product_id: sbProduct.id, bag_type: 'SB', requested_qty: form.sb_qty });
      }

      const jbPrice =
        form.source === 'port' ? jbProduct?.price_port || 0 : jbProduct?.price_warehouse || 0;
      const sbPrice =
        form.source === 'port' ? sbProduct?.price_port || 0 : sbProduct?.price_warehouse || 0;
      const subtotal = form.jb_qty * jbPrice + form.sb_qty * sbPrice;

      let notes = '';
      if (form.service_type === 'pickup' && form.preferred_pickup_date) {
        notes = `Preferred Pick-up Date: ${form.preferred_pickup_date}`;
      }
      if (checkImageUrl) {
        notes += `${notes ? '\n' : ''}Check image uploaded.`;
      }

      const orderData = {
        source: form.source,
        service_type: form.service_type,
        payment_method: form.payment_method,
        po_number: form.po_number,
        po_image_url: poImageUrl,
        supplier_name: form.supplier_name,
        driver_name: form.service_type === 'pickup' ? form.driver_name : null,
        plate_number: form.service_type === 'pickup' ? form.plate_number : null,
        preferred_pickup_date:
          form.service_type === 'pickup' ? form.preferred_pickup_date : undefined,
        total_amount: subtotal,
        items,
        notes: notes.trim(),
      };

      const splitDetails = form.wants_split
        ? {
            wantsSplit: true,
            deliverNowQty: form.deliver_now_jb + form.deliver_now_sb,
            deliverNowJB: form.deliver_now_jb,
            deliverNowSB: form.deliver_now_sb,
            splitNote: `Client requested ${form.deliver_now_jb + form.deliver_now_sb} bags now (${form.deliver_now_jb} JB, ${form.deliver_now_sb} SB). Service: ${form.service_type}.`,
          }
        : undefined;

      await submitOrder(orderData, splitDetails);

      toast.success('Order submitted successfully! Pending approval.');
      clearForm();
      router.push('/client/orders');
    } catch (err) {
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

      const items: { product_id: string; bag_type: string; requested_qty: number }[] = [];
      const jbProduct = products.find((p) => p.bag_type === 'JB');
      const sbProduct = products.find((p) => p.bag_type === 'SB');

      if (form.jb_qty > 0 && jbProduct) {
        items.push({ product_id: jbProduct.id, bag_type: 'JB', requested_qty: form.jb_qty });
      }
      if (form.sb_qty > 0 && sbProduct) {
        items.push({ product_id: sbProduct.id, bag_type: 'SB', requested_qty: form.sb_qty });
      }

      const jbPrice =
        form.source === 'port' ? jbProduct?.price_port || 0 : jbProduct?.price_warehouse || 0;
      const sbPrice =
        form.source === 'port' ? sbProduct?.price_port || 0 : sbProduct?.price_warehouse || 0;
      const subtotal = form.jb_qty * jbPrice + form.sb_qty * sbPrice;

      const orderData = {
        source: form.source,
        service_type: form.service_type,
        payment_method: form.payment_method,
        po_number: form.po_number,
        po_image_url: poImageUrl,
        supplier_name: form.supplier_name,
        driver_name: form.service_type === 'pickup' ? form.driver_name : null,
        plate_number: form.service_type === 'pickup' ? form.plate_number : null,
        preferred_pickup_date:
          form.service_type === 'pickup' ? form.preferred_pickup_date : undefined,
        total_amount: subtotal,
        items,
        notes: '',
      };

      const splitDetails = form.wants_split
        ? {
            wantsSplit: true,
            deliverNowQty: form.deliver_now_jb + form.deliver_now_sb,
            deliverNowJB: form.deliver_now_jb,
            deliverNowSB: form.deliver_now_sb,
          }
        : undefined;

      await saveOrderDraft(orderData, splitDetails);

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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Submit Purchase Order</h2>
        <p className="text-muted-foreground mt-1">
          Enter your PO details and review before submitting.
        </p>
      </div>

      <StepIndicator
        steps={SUBMIT_STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={goToStep}
      />

      <div className="relative overflow-hidden">
        <div key={currentStep} className="animate-slide-in-right">
          {currentStep === 0 && (
            <StepPoPayment
              form={form}
              files={{ po_file: poFile, check_file: checkFile }}
              onFieldChange={updateField}
              onFileChange={(field, file) => {
                if (field === 'po_file') setPoFile(file);
                else setCheckFile(file);
              }}
              errors={errors}
              totalJB={form.jb_qty}
              totalSB={form.sb_qty}
              totalIndividualBags={form.jb_qty * 25 + form.sb_qty * 50}
            />
          )}
          {currentStep === 1 && (
            <StepOrderReview
              form={form}
              files={{ po_file: poFile, check_file: checkFile }}
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

      {/* Navigation Buttons — hidden on review step */}
      {currentStep < SUBMIT_STEPS.length - 1 && (
        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" className="h-11 gap-1" onClick={goBack}>
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 0 ? 'Back to Ordering' : 'Back'}
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
      {currentStep === SUBMIT_STEPS.length - 1 && (
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
