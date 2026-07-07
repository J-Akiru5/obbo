'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { Upload, X, FileCheck, Split, Camera } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StepPoPaymentProps {
  form: {
    po_number: string;
    payment_method: 'cash' | 'check';
    wants_split: boolean;
    deliver_now_total: number;
  };
  files: {
    po_file: File | null;
    check_file: File | null;
  };
  onFieldChange: (field: string, value: string | boolean | number) => void;
  onFileChange: (field: 'po_file' | 'check_file', file: File | null) => void;
  errors: Record<string, string>;
  totalBags: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function FileDropZone({
  label,
  file,
  onFileChange,
  error,
  inputId,
  required = true,
}: {
  label: string;
  file: File | null;
  onFileChange: (f: File | null) => void;
  error?: string;
  inputId: string;
  required?: boolean;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_FILE_SIZE) {
      toast.error(`File exceeds the 10MB size limit. Please use a smaller file.`);
      e.target.value = '';
      return;
    }
    onFileChange(selected);
  }
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/50">
          <FileCheck className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-emerald-800 dark:text-emerald-200">{file.name}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="hover:text-destructive h-8 w-8 flex-shrink-0 border-emerald-300 hover:bg-emerald-100 dark:border-emerald-700 dark:hover:bg-emerald-900"
            onClick={() => onFileChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className="border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors"
          onClick={() => document.getElementById(inputId)?.click()}
        >
          <Upload className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">Click to upload</p>
          <p className="text-muted-foreground/60 mt-1 text-xs">JPG, PNG, PDF &middot; max 10MB</p>
          <input
            id={inputId}
            type="file"
            className="hidden"
            accept="image/*,.pdf"
            onChange={handleChange}
          />
        </div>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

export function StepPoPayment({
  form,
  files,
  onFieldChange,
  onFileChange,
  errors,
  totalBags,
}: StepPoPaymentProps) {
  const remainingBalance = totalBags - form.deliver_now_total;

  useEffect(() => {
    if (!form.wants_split) {
      onFieldChange('deliver_now_total', totalBags);
    } else {
      if (form.deliver_now_total > totalBags) onFieldChange('deliver_now_total', totalBags);
    }
  }, [form.wants_split, totalBags, onFieldChange, form.deliver_now_total]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">PO & Payment</h2>
        <p className="text-muted-foreground text-sm">
          Enter purchase order details, payment method, and optional split delivery.
        </p>
      </div>

      {/* PO Number */}
      <div>
        <Label htmlFor="po_number" className="text-sm font-medium">
          PO Number <span className="text-destructive">*</span>
        </Label>
        <Input
          id="po_number"
          value={form.po_number}
          onChange={(e) => onFieldChange('po_number', e.target.value)}
          placeholder="PO-2026-001"
          className="mt-1.5 h-11"
        />
        {errors.po_number && <p className="text-destructive mt-1 text-sm">{errors.po_number}</p>}
      </div>

      {/* PO Image */}
      <FileDropZone
        label="PO Picture"
        file={files.po_file}
        onFileChange={(f) => onFileChange('po_file', f)}
        error={errors.po_file}
        inputId="po-upload"
      />

      {/* Payment Method */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Payment method <span className="text-destructive">*</span>
        </Label>
        <Select
          value={form.payment_method}
          onValueChange={(v) => {
            if (v) onFieldChange('payment_method', v);
          }}
        >
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="check">Check</SelectItem>
          </SelectContent>
        </Select>
        {errors.payment_method && (
          <p className="text-destructive text-sm">{errors.payment_method}</p>
        )}
      </div>

      {/* Check image (conditional) */}
      {form.payment_method === 'check' && (
        <div className="space-y-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight text-blue-600 uppercase">
            <Camera className="h-4 w-4" />
            Check details
          </div>
          <FileDropZone
            label="Check image"
            file={files.check_file}
            onFileChange={(f) => onFileChange('check_file', f)}
            error={errors.check_file}
            inputId="check-upload"
          />
        </div>
      )}

      {/* Split Delivery Options panel row layout mapping */}
      <div className="space-y-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Split className="h-4 w-4 text-blue-500" />
            <div>
              <h4 className="text-sm font-bold tracking-tight text-blue-600 uppercase">
                Split delivery option
              </h4>
              <p className="text-xs text-blue-500/80">
                Receive part of your order now; the rest is saved for later.
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={form.wants_split}
              onChange={(e) => onFieldChange('wants_split', e.target.checked)}
              className="bg-background h-5 w-5 rounded border-blue-500/30 text-blue-600 focus:ring-blue-500"
            />
            <span className="sr-only">Enable split delivery</span>
          </label>
        </div>

        {form.wants_split && (
          <div className="space-y-4 border-t border-blue-500/20 pt-3">
            <div>
              <Label className="text-xs font-bold text-blue-600 uppercase">
                Bags to receive now (max {totalBags})
              </Label>
              <Input
                type="number"
                min={0}
                max={totalBags}
                value={form.deliver_now_total || ''}
                placeholder="0"
                onChange={(e) =>
                  onFieldChange(
                    'deliver_now_total',
                    Math.min(totalBags, Math.max(0, parseInt(e.target.value) || 0)),
                  )
                }
                className="mt-1.5 h-10 border-blue-500/20 font-semibold"
              />
            </div>

            <div className="rounded border border-blue-500/20 bg-blue-500/10 p-3 text-sm">
              <div className="flex justify-between font-bold text-blue-600">
                <span>Delivering now</span>
                <span>{form.deliver_now_total.toLocaleString()} bags</span>
              </div>
              <div className="mt-1 flex justify-between font-medium text-blue-500/70">
                <span>Remaining balance</span>
                <span>{remainingBalance.toLocaleString()} bags</span>
              </div>
            </div>

            {errors.deliver_now_total && (
              <p className="text-destructive text-sm">{errors.deliver_now_total}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
