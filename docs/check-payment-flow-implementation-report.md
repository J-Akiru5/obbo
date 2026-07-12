# Check Payment Flow — Implementation Report

**Date:** 2026-07-13
**Status:** Ready for review (not merged)
**Reviewer:** Claude (Sonnet)

---

## Overview

Implemented four changes per `check-payment-flow-implementation-plan.md` to defer check-image upload for Deliver + Check orders, notify clients when their check payment is due, and harden the profit calculation invariant.

**No migration added.** All statuses and columns already exist.

---

## STEP 0 — Verification Findings

### 0.1 Wizard state shape (`service_type` presence)

- **Parent container:** `src/app/client/orders/new/page.tsx`
- State managed via `usePersistedForm('obbo-order-form', INITIAL_FORM)` where `INITIAL_FORM` includes `service_type: 'pickup' as 'pickup' | 'deliver'`
- Step 3 (`StepPoPayment`) receives `form={form}` — the **full** accumulated wizard object, which includes `service_type` at runtime
- However, `StepPoPaymentProps.form` only declared `po_number`, `payment_method`, `wants_split`, `deliver_now_total` (no `service_type`)
- `poPaymentSchema` did not include `service_type` either
- The `.safeParse()` call at line 229 passed a 6-field subset — `service_type` was not included
- **Adaptation:** Added `service_type` to the props interface, the schema, AND the safeParse call site

### 0.2 `createUserNotification` signature

- `createUserNotification({ userId, title, message, href?, severity? })` → `Promise<{ error: string } | { success: true }>`
- Order's client id field: `client_id` (TypeScript interface) / `clientId` (Prisma)
- **Plan's assumptions matched exactly** — no adaptation needed

---

## STEP 1 — Wizard Schema

### File

`src/components/orders/wizard/order-schema.ts:36,42-45`
`src/app/client/orders/new/page.tsx:234`

### Change

**Schema** — added `service_type` field and updated refine:

```diff
export const poPaymentSchema = z
  .object({
    po_number: z.string().min(1, 'PO number is required'),
    po_file: z.custom<File>().refine((f) => f instanceof File && f.size > 0, 'PO image is required'),
    payment_method: z.enum(['cash', 'check'], 'Please select a payment method'),
    check_file: z.custom<File>().optional(),
+   service_type: z.enum(['pickup', 'deliver']).optional(),
    wants_split: z.boolean(),
    deliver_now_jb: z.number().min(0),
    deliver_now_sb: z.number().min(0),
  })
  .refine(
-   (d) => d.payment_method !== 'check' || (d.check_file instanceof File && d.check_file.size > 0),
+   (d) =>
+     d.payment_method !== 'check' ||
+     d.service_type === 'deliver' ||
+     (d.check_file instanceof File && d.check_file.size > 0),
    { message: 'Check image is required for check payment', path: ['check_file'] },
  );
```

**Call site** — added `service_type` to the safeParse data:

```diff
 const result = poPaymentSchema.safeParse({
   po_number: form.po_number,
   po_file: poFile,
   payment_method: form.payment_method,
   check_file: checkFile,
+  service_type: form.service_type,
   wants_split: form.wants_split,
   deliver_now_total: form.deliver_now_total,
 });
```

### Behavior

- `check_file` required when `payment_method === 'check' AND service_type !== 'deliver'` (Pickup + Check)
- `check_file` NOT required when `payment_method !== 'check'` OR `service_type === 'deliver'` (Cash or Deliver + Check)
- All other field validations (`po_number`, `po_file`, `wants_split`, split quantities) — untouched

---

## STEP 2 — Wizard UI

### File

`src/components/orders/wizard/step-po-payment.tsx:21,184,199-205`

### Changes

**Props interface** — added `service_type`:

```diff
 interface StepPoPaymentProps {
   form: {
     po_number: string;
     payment_method: 'cash' | 'check';
+    service_type: 'pickup' | 'deliver';
     wants_split: boolean;
     deliver_now_total: number;
   };
```

**Check-upload block condition:**

```diff
-{form.payment_method === 'check' && (
+{form.payment_method === 'check' && form.service_type !== 'deliver' && (
   <div className="space-y-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
     ...unchanged check upload UI...
   </div>
 )}
```

**Inline note for Deliver + Check (replaces the hidden upload block):**

```tsx
{
  form.payment_method === 'check' && form.service_type === 'deliver' && (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
      <p className="text-muted-foreground text-sm">
        You&apos;ll be asked to upload your check after the shipping fee is confirmed.
      </p>
    </div>
  );
}
```

### Visual style

- Same `rounded-lg border border-blue-500/20 bg-blue-500/5 p-4` container as the upload block
- `text-muted-foreground text-sm` for the message text (matches the step's existing typography conventions)
- No new component — inline JSX

---

## STEP 3 — Client Notification on Approval

### File

`src/lib/actions/orders-actions.ts:6,115-131`

### Import

```diff
-import { createRoleNotification } from './notification-actions';
+import { createRoleNotification, createUserNotification } from './notification-actions';
```

### Notification logic (inserted after customer balance block, before logActivity)

```ts
// Notify client when order transitions to awaiting_check
if (newStatus === 'awaiting_check') {
  try {
    const finalShippingFee = shippingFee ?? order.shipping_fee ?? 0;
    const totalDue = Number(order.total_amount) + Number(finalShippingFee);
    await createUserNotification({
      userId: order.client_id,
      title: 'Order approved — payment due',
      message:
        `Your order is approved. Total due: ₱${totalDue.toLocaleString()} ` +
        `(includes ₱${Number(finalShippingFee).toLocaleString()} shipping). ` +
        `Please upload your check to proceed.`,
    });
  } catch (notifError) {
    console.error('Failed to send awaiting_check notification:', notifError);
  }
}
```

### Constraints satisfied

- Only fires for `newStatus === 'awaiting_check'` — not for `approved`, `partially_approved`, or `rejected`
- Wrapped in try/catch — notification failure never throws, blocks, or rolls back the approval
- Includes total due (goods + shipping) and shipping fee separately in the message

---

## STEP 4a — Profit Invariant Comment

### File

`src/lib/actions/orders-actions.ts:253-255`

### Change

```diff
   // Compute profit values
   const costConfig = await getCostConfig();
   const totalBags = jbQty * 25 + sbQty * 50;
+  // INVARIANT: total_amount is the goods subtotal only. shipping_fee is tracked
+  // separately and must NEVER be folded into total_amount or included in profit.
+  // See: implementation-plan §3.4 / structure diagrams §7 (Financial Invariant).
   const totalSales = Number(order.total_amount) || 0;
```

**No change to the calculation itself** — `totalSales = Number(order.total_amount) || 0` is currently correct precisely because `total_amount` is goods-only.

---

## STEP 4b — Regression Test

### File

`src/lib/actions/orders-actions.test.ts`

### Test added

`dispatchOrder > profit values are identical regardless of shipping_fee (INVARIANT: total_amount is goods-only)`

### Approach

- Created two otherwise-identical order fixtures differing only in `shipping_fee` (0 vs 500)
- Used MSW to mock Supabase endpoints: `orders`, `shipments`, `shipment_ledger`, `activity_log`
- Called `dispatchOrder` twice, captured ledger insert bodies
- Asserted `total_sales`, `gross_profit`, `net_profit` are identical for both runs

### Mock adaptations (deviations from plan)

1. **`getCostConfig` internal reference** — `getCostConfig()` calls `requireAdmin()` via internal module scope in `admin-helpers.ts`, which bypasses vitest's export-level mock. Mocked `getCostConfig` directly in the test file to return fixed values.

2. **`revalidatePath` mock** — Added `vi.mock('next/cache', ...)` since the function isn't available in the jsdom test environment.

### Test result

```
✓ src/lib/actions/orders-actions.test.ts (4 tests)
```

---

## Verification Summary

| Check                        | Result                              |
| ---------------------------- | ----------------------------------- |
| `npx vitest run`             | **24/24 passed** (all 5 test files) |
| `npx eslint` (touched files) | **0 errors**                        |
| `npx tsc --noEmit`           | **0 errors**                        |

---

## Explicit Confirmations

| Requirement                                                       | Status |
| ----------------------------------------------------------------- | ------ |
| No new migration added                                            | ✅     |
| `total_amount` meaning unchanged (goods-only)                     | ✅     |
| Cash order behavior unchanged                                     | ✅     |
| Pickup + Check behavior unchanged                                 | ✅     |
| Profit calculation logic unchanged                                | ✅     |
| Deliver + Check: wizard does NOT ask for check image at Step 3    | ✅     |
| Deliver + Check: shows "upload after shipping fee" note at Step 3 | ✅     |
| `awaiting_check` transition sends client notification             | ✅     |

---

## Deviations from Plan

1. **Page.tsx safeParse call** — The plan described adding `service_type` to the schema but didn't explicitly note that the `.safeParse()` call site in `page.tsx` passes a subset of form fields. Without adding `service_type` there, the refine would never receive it (always `undefined`), making the Deliver + Check exception dead code. Fixed by adding `service_type: form.service_type` to the safeParse data.

2. **Test `getCostConfig` mock** — The plan didn't anticipate that `getCostConfig()` internally references the unmocked `requireAdmin()` via JavaScript module-scope resolution. Added `getCostConfig` to the mock directly in the test file.
