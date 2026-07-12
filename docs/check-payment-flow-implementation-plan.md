# OBBO iManage — CHECK + Deliver Payment Flow: Implementation Plan

**Status:** Ready for implementation, pending 2 verification items (see §5)
**Author:** Claude (gating reviewer), based on read-only agent investigation dated 2026-07-13
**No new migration required.** All statuses and columns needed already exist.

---

## 1. Problem Statement

For orders with `service_type = deliver` and `payment_method = check`, the client is currently forced to upload a check image during wizard Step 3 (PO & Payment) — before the warehouse manager has added the shipping fee. This means the client commits to a check amount before the real total (goods + shipping) exists. The upload is also silently discarded server-side, since `submitOrder()` doesn't accept check fields at all — so the client does this for nothing and has to re-upload later anyway.

## 2. Root Cause

A single client-side Zod `.refine()` in the order wizard requires `check_file` whenever `payment_method === 'check'`, with no regard for `service_type`. Everything downstream — `awaiting_check` status, the shipping-fee input in the manager approval dialog, the post-approval "Upload Check Details" dialog, and `submitPaymentDetails()` — already implements the correct deferred flow. One notification is also missing (client is never told the order needs their action), and one calculation is fragile-but-currently-correct (shipping fee exclusion from profit).

## 3. Scope of Changes

Four changes, in priority order:

### 3.1 Wizard schema — stop requiring check image upfront for Deliver orders

**File:** `src/components/orders/wizard/order-schema.ts`

**Current:**

```ts
.refine(
  (d) => d.payment_method !== 'check' || (d.check_file instanceof File && d.check_file.size > 0),
  { message: 'Check image is required for check payment', path: ['check_file'] },
);
```

**Target behavior:** `check_file` should only be required when `payment_method === 'check'` **and** `service_type !== 'deliver'` (i.e., Pickup + Check keeps today's behavior, since there's no manager-added fee to wait for). Deliver + Check should not require it at all at this step.

**Implementation note:** this requires `service_type` to be visible to this schema/refine. Two viable approaches, pick whichever matches what verification (§5.1) finds:

- **If the step's `form` object already carries `service_type`** (likely, since the investigated JSX already reads `form.payment_method` off what appears to be the full accumulated wizard state): extend the refine's predicate to also check `d.service_type !== 'deliver'`, adding `service_type` as a field on the schema object (or `.passthrough()`) so it's available inside `.refine()`.
- **If Step 3 only validates its own slice** and `service_type` genuinely isn't reachable at parse time: move this specific cross-field rule out of Zod and into the step component / wizard submit handler as a plain conditional, using the full accumulated form state.

Either way, do **not** touch the `payment_method` enum or the `po_number`/`po_file` requirements — those are unrelated and already correct for both service types.

### 3.2 Wizard UI — hide the check-upload block for Deliver + Check

**File:** `src/components/orders/wizard/step-po-payment.tsx`

**Current** (around L183–197): the check-upload block renders whenever `form.payment_method === 'check'`.

**Target:**

```tsx
{
  form.payment_method === 'check' && form.service_type !== 'deliver' && (
    <div className="space-y-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
      ...unchanged...
    </div>
  );
}
```

Add a short inline note in its place for `deliver` + `check` orders, e.g.: _"You'll be asked to upload your check after the shipping fee is confirmed."_ — this replaces the removed upload block so the step doesn't look empty, and sets the client's expectation. Keep this string short and in Claude's own words (no existing copy to preserve here).

### 3.3 Client notification when manager approves a CHECK order

**File:** `src/lib/actions/orders-actions.ts`, inside `approveOrder()`

**Where:** after the status/shipping-fee update currently at L89–95, when `newStatus === 'awaiting_check'`.

**Target (pseudocode — confirm exact signature per §5.2 before writing):**

```ts
if (newStatus === 'awaiting_check') {
  const finalShippingFee = shippingFee ?? order.shipping_fee ?? 0;
  const totalDue = Number(order.total_amount) + Number(finalShippingFee);
  await createUserNotification(
    /* client identifier field — confirm exact column name */ order.client_id,
    'Order approved — payment due',
    `Your order is approved. Total due: ₱${totalDue.toLocaleString()} ` +
      `(includes ₱${Number(finalShippingFee).toLocaleString()} shipping). ` +
      `Please upload your check to proceed.`,
  );
}
```

Constraints:

- This must not run for cash orders, or for orders that go straight to `approved`/`partially_approved`.
- Must not throw or block the approval transaction if notification creation fails — wrap in try/catch and log; a failed notification should never leave the order stuck or roll back the approval.
- Reuse whichever of `createRoleNotification` / `createUserNotification` already matches "send to one specific client" (investigation indicates `createUserNotification`).

### 3.4 Harden the profit calculation against shipping-fee leakage

**File:** `src/lib/actions/orders-actions.ts`, inside `dispatchOrder()` (around L232–244)

**Do not change the calculation itself** — `totalSales = Number(order.total_amount) || 0` is currently correct precisely because `total_amount` is goods-only. Subtracting `shipping_fee` here would double-count and silently break profit numbers, since it isn't included in the first place. Instead:

1. Add an explicit code comment stating the invariant:
   ```ts
   // INVARIANT: total_amount is the goods subtotal only. shipping_fee is tracked
   // separately and must NEVER be folded into total_amount or included in profit.
   // See: implementation-plan §3.4 / structure diagrams §7 (Financial Invariant).
   const totalSales = Number(order.total_amount) || 0;
   ```
2. Add a regression test (new or extended test file, e.g. `src/lib/actions/orders-actions.test.ts`) asserting that for a fixture order with a non-zero `shipping_fee`, `dispatchOrder()`'s resulting `total_sales` / `gross_profit` / `net_profit` in the ledger are identical to the same order with `shipping_fee = 0`. This protects the invariant going forward without touching working logic today.

This is the safest form of "hardening" available given the current data model — it converts a currently-accidental correctness into a tested, documented one.

## 4. Explicit Non-Goals

- **No new `order_status` value.** `awaiting_check` and `pending_final_confirmation` already do the job.
- **No move of `awaiting_check` orders into the "Pending Approval" tab.** They stay under "Active & Tracking," which already shows the shipping-fee banner. The notification (3.3) is what closes the actual gap the bug report describes. See open question in the diagrams doc §8.3 if this assumption needs to be challenged.
- **No change to `total_amount`'s meaning.** It remains goods-only; shipping is always added at display time (already done correctly in the client payment dialog and should be mirrored in the new notification copy).
- **No touching of `dispatchOrder()`'s dispatch notification (or lack thereof) — out of scope for this bug.**

## 5. Verification Required Before Writing Code

These two items were not resolved by the read-only scan and must be confirmed by the implementing agent as its first step, before touching any file:

1. **Wizard state shape** — Is `service_type` (set in Step 2) actually present on the object validated/read inside Step 3 (`poPaymentSchema` and `step-po-payment.tsx`)? Locate and inspect the wizard's parent/container component (not covered in the original scan) that composes multi-step state, e.g. something like `order-wizard.tsx` or a `use-order-wizard` hook.
2. **`createUserNotification` exact signature** — parameter order/names, and the correct field name on `Order` for the client's user id (`client_id` vs `user_id` vs `profile_id`).

If either resolves differently than assumed above, adjust the target snippets in §3.1 / §3.3 accordingly — the intent (not the exact code) is what must be preserved.

## 6. Manual QA Checklist (post-implementation)

- [ ] Create order: Deliver + Check → wizard does **not** ask for check image at Step 3, shows the "you'll upload after shipping fee" note instead
- [ ] Create order: Pickup + Check → wizard **still** requires check image upfront (unchanged behavior)
- [ ] Manager approves the Deliver+Check order with a shipping fee → status becomes `awaiting_check`, client receives a notification with total including shipping
- [ ] Client opens the order → sees goods + shipping total, uploads check image + number → status becomes `pending_final_confirmation`
- [ ] Admin confirms the check → status becomes `approved` (or `partially_approved` for split delivery)
- [ ] Dispatch the order → ledger's `total_sales`/`gross_profit`/`net_profit` unaffected by the shipping fee value (compare against a same-order fixture with `shipping_fee = 0`)
- [ ] Cash orders (both service types) → completely unaffected, no behavior change

## 7. Risk & Rollback

- Changes are isolated to 2 client-side wizard files + 1 server action file; no schema/migration risk.
- If the notification call in 3.3 causes issues, it can be removed/no-op'd without affecting the status transition logic (it's additive, wrapped in try/catch).
- If 3.1/3.2 need to be reverted, the wizard simply returns to requiring check upload upfront for all CHECK orders — no data loss, since check fields are already nullable.
