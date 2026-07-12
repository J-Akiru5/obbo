'use client';

import { Pencil, CheckCircle2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Product } from '@/lib/types/database';
import { getPrice, getTotalIndividualBags, getSubtotalByBagType } from './order-schema';

interface StepOrderReviewProps {
  form: {
    jb_qty: number;
    sb_qty: number;
    source: string;
    service_type: string;
    driver_name: string;
    plate_number: string;
    preferred_pickup_date: string;
    po_number: string;
    payment_method: string;
    wants_split: boolean;
    deliver_now_total: number;
  };
  files: {
    po_file: File | null;
    check_file: File | null;
  };
  products: Product[];
  onEditStep: (step: number) => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  loading: boolean;
  draftLoading: boolean;
}

function ReviewSection({
  title,
  stepIndex,
  onEdit,
  children,
}: {
  title: string;
  stepIndex: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-lg border">
      <div className="bg-muted/30 flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onEdit(stepIndex)}
        >
          <Pencil className="h-3 w-3" /> Edit
        </Button>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="text-muted-foreground w-36 flex-shrink-0 text-xs">{label}</span>
      <span className="text-foreground text-sm font-medium break-words">{value || '\u2014'}</span>
    </div>
  );
}

export function StepOrderReview({
  form,
  files,
  products,
  onEditStep,
  onSubmit,
  onSaveDraft,
  loading,
  draftLoading,
}: StepOrderReviewProps) {
  const jbProduct = products.find((p) => p.bag_type === 'JB');
  const sbProduct = products.find((p) => p.bag_type === 'SB');
  const jbPrice = getPrice(jbProduct, form.source);
  const sbPrice = getPrice(sbProduct, form.source);
  const totalBags = getTotalIndividualBags(form.jb_qty, form.sb_qty);
  const subtotal = getSubtotalByBagType(form.jb_qty, form.sb_qty, jbPrice, sbPrice);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">Review & submit</h2>
        <p className="text-muted-foreground text-sm">
          Review your order details before submitting.
        </p>
      </div>

      <div className="space-y-3">
        {/* Products */}
        <ReviewSection title="Products" stepIndex={0} onEdit={onEditStep}>
          {form.jb_qty > 0 && (
            <ReviewField label="JB units" value={`${form.jb_qty} JB (${form.jb_qty * 25} bags)`} />
          )}
          {form.sb_qty > 0 && (
            <ReviewField label="SB units" value={`${form.sb_qty} SB (${form.sb_qty * 50} bags)`} />
          )}
          <ReviewField label="Total individual bags" value={totalBags.toLocaleString()} />
        </ReviewSection>

        {/* Source */}
        <ReviewSection title="Source" stepIndex={1} onEdit={onEditStep}>
          <ReviewField label="Source" value={form.source === 'port' ? 'Port' : 'Warehouse'} />
          {form.jb_qty > 0 && (
            <ReviewField
              label="JB price"
              value={`₱${jbPrice.toLocaleString()}/bag × ${form.jb_qty * 25} bags = ₱${(form.jb_qty * 25 * jbPrice).toLocaleString()}`}
            />
          )}
          {form.sb_qty > 0 && (
            <ReviewField
              label="SB price"
              value={`₱${sbPrice.toLocaleString()}/bag × ${form.sb_qty * 50} bags = ₱${(form.sb_qty * 50 * sbPrice).toLocaleString()}`}
            />
          )}
        </ReviewSection>

        {/* Service Type */}
        <ReviewSection title="Service type" stepIndex={2} onEdit={onEditStep}>
          <ReviewField
            label="Service type"
            value={form.service_type === 'pickup' ? 'Pick up' : 'Deliver'}
          />
          {form.service_type === 'pickup' && (
            <>
              <ReviewField label="Driver name" value={form.driver_name} />
              <ReviewField label="Plate number" value={form.plate_number} />
              {form.preferred_pickup_date && (
                <ReviewField label="Preferred date" value={form.preferred_pickup_date} />
              )}
            </>
          )}
        </ReviewSection>

        {/* PO & Payment */}
        <ReviewSection title="PO & Payment" stepIndex={3} onEdit={onEditStep}>
          <ReviewField label="PO Number" value={form.po_number} />
          <ReviewField label="Supplier" value="OBBO" />
          <ReviewField label="PO image" value={files.po_file?.name ?? 'No file'} />
          <ReviewField
            label="Payment method"
            value={form.payment_method === 'cash' ? 'Cash' : 'Check'}
          />
          {form.payment_method === 'check' && (
            <ReviewField label="Check image" value={files.check_file?.name ?? 'No file'} />
          )}
          {form.wants_split && (
            <>
              <Separator className="my-2" />
              <ReviewField
                label="Split delivery"
                value={`Deliver ${form.deliver_now_total.toLocaleString()} now, ${(totalBags - form.deliver_now_total).toLocaleString()} remaining`}
              />
            </>
          )}
        </ReviewSection>
      </div>

      {/* Subtotal */}
      <div className="bg-primary text-primary-foreground space-y-2 rounded-lg p-4 shadow-inner">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/80">Order subtotal</p>
            {form.service_type === 'deliver' && (
              <p className="mt-0.5 text-xs text-white/60">
                + Shipping fee (added by warehouse manager after approval)
              </p>
            )}
          </div>
          <p className="text-2xl font-bold">₱{subtotal.toLocaleString()}</p>
        </div>
        <div className="space-y-1 text-xs text-white/70">
          {form.jb_qty > 0 && (
            <div className="flex justify-between">
              <span>
                {form.jb_qty} JB × {form.jb_qty * 25} bags × ₱{jbPrice.toLocaleString()}
              </span>
              <span>₱{(form.jb_qty * 25 * jbPrice).toLocaleString()}</span>
            </div>
          )}
          {form.sb_qty > 0 && (
            <div className="flex justify-between">
              <span>
                {form.sb_qty} SB × {form.sb_qty * 50} bags × ₱{sbPrice.toLocaleString()}
              </span>
              <span>₱{(form.sb_qty * 50 * sbPrice).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onSaveDraft}
          disabled={loading || draftLoading}
        >
          {draftLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save as Draft
        </Button>
        <Button
          type="button"
          className="min-w-44 gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
          onClick={onSubmit}
          disabled={loading || draftLoading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Submit for Approval
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
