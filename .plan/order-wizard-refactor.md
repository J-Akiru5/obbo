# Plan: Refactor Client Ordering Module into Multi-Page Wizard

## Context

The current new order flow at `/client/orders/new` is a **single-page 5-step wizard** (Products → Source → Service → PO & Payment → Review). Per panel feedback, this needs to be split into two distinct pages:

1. **Ordering** (Steps 0-2): Select products, choose source, pick service type
2. **Submitting POs** (Steps 3-4): Enter PO/payment details, review, and submit

Data must persist as the user navigates between pages. The existing `usePersistedForm` hook (sessionStorage-backed) already handles cross-page persistence.

## Route Structure

```
/client/orders/new          → Ordering page (Products, Source, Service Type)
/client/orders/new/submit   → Submitting POs page (PO & Payment, Review)
```

Both pages share the same `usePersistedForm("obbo-order-form", ...)` key, so form data persists across navigation automatically.

## Files to Modify

| File                                           | Action         | Purpose                                                             |
| ---------------------------------------------- | -------------- | ------------------------------------------------------------------- |
| `src/app/client/orders/new/page.tsx`           | **Rewrite**    | Ordering page: steps 0-2 + "Proceed to PO" button                   |
| `src/app/client/orders/new/submit/page.tsx`    | **Create**     | Submitting POs page: steps 3-4 + back navigation                    |
| `src/components/orders/wizard/order-schema.ts` | **Keep as-is** | Schemas already support per-step validation                         |
| `src/components/ui/step-indicator.tsx`         | **Keep as-is** | Reusable, works with any step array                                 |
| `src/components/orders/wizard/step-*.tsx`      | **Keep as-is** | Step components are presentational, no changes needed               |
| `src/lib/hooks/use-persisted-form.ts`          | **Keep as-is** | Already handles sessionStorage persistence                          |
| `src/app/client/layout.tsx`                    | **Keep as-is** | Lock href already covers `/client/orders/new` (matches both routes) |

## Implementation Details

### 1. Rewrite `src/app/client/orders/new/page.tsx` — Ordering Page

- **Steps displayed**: Products (0), Source (1), Service Type (2)
- **Step labels**: `["Products", "Source", "Service"]`
- **StepIndicator**: Shows 3 steps, tracks completedSteps within this page
- **Form state**: `usePersistedForm("obbo-order-form", INITIAL_FORM)` — same key
- **Products fetched on mount** (existing logic)
- **No PO auto-generation** on this page (moved to submit page)
- **Navigation**:
  - "Continue" validates current step → marks complete → advances
  - "Back" on step 0 → navigates to `/client/orders` (order list)
  - "Continue" on step 2 (last step) → validates → navigates to `/client/orders/new/submit`
- **KYC check**: Keep existing guard
- **Loading products state**: Keep existing guard

Key changes from current:

- Remove steps 3-4 rendering
- Remove PO number auto-generation useEffect
- Remove `handleSubmit`, `handleSaveDraft`, `uploadFile` (move to submit page)
- Remove `poFile`, `checkFile` state (move to submit page)
- Replace final "Continue" button on step 2 with `router.push("/client/orders/new/submit")`
- Back button on step 0 goes to `/client/orders`

### 2. Create `src/app/client/orders/new/submit/page.tsx` — Submitting POs Page

- **Steps displayed**: PO & Payment (0), Review (1)
- **Step labels**: `["PO & Payment", "Review"]`
- **StepIndicator**: Shows 2 steps
- **Form state**: `usePersistedForm("obbo-order-form", INITIAL_FORM)` — same key, hydrates from sessionStorage
- **Auto-generate PO number on mount** (moved from ordering page)
- **Products fetched on mount** (needed for Review step price calculations)
- **File state**: `poFile`, `checkFile` local state
- **Navigation**:
  - "Back" button on step 0 → navigates to `/client/orders/new`
  - "Back" button on step 1 → goes to step 0 (PO & Payment)
  - StepIndicator allows clicking completed steps
- **Submit/Draft logic**: Move `handleSubmit`, `handleSaveDraft`, `uploadFile` here
- **KYC check**: Keep existing guard

### 3. Back Navigation from Submit → Ordering

When user clicks "Back" from the submit page's first step (PO & Payment), they return to `/client/orders/new`. The ordering page will hydrate its state from sessionStorage (same key), so all previously entered data (products, source, service type) is restored.

The ordering page should **restore `currentStep` to 2** (the last step) when navigating back from submit, since all ordering steps are completed. This can be done by:

- Storing `currentStep` in the persisted form state
- Or detecting that we're navigating back (e.g., checking if step 2 data exists)
- Simplest: always start ordering page at step 0, but mark steps 0-2 as completed if data exists

Actually, the cleanest approach: **Store `completedSteps` and `currentStep` in the persisted form**. When the ordering page mounts, it reads these from sessionStorage and restores the wizard state.

### 4. Data Flow Diagram

```
/client/orders/new (Ordering Page)
  ┌─────────────────────────────────────┐
  │  Step 0: Products                   │
  │  Step 1: Source                     │
  │  Step 2: Service Type               │
  │                                     │
  │  [Back to Orders]  [Continue →]     │
  └──────────────────┬──────────────────┘
                     │ router.push("/client/orders/new/submit")
                     ▼
/client/orders/new/submit (Submitting POs Page)
  ┌─────────────────────────────────────┐
  │  Step 0: PO & Payment               │
  │  Step 1: Review                     │
  │                                     │
  │  [← Back to Ordering]               │
  │  [Save as Draft] [Submit for ✓]     │
  └─────────────────────────────────────┘
```

### 5. SessionStorage State Shape

Extend `INITIAL_FORM` to include wizard navigation state:

```ts
const INITIAL_FORM = {
  // Existing order fields
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
  // Wizard navigation state (for cross-page persistence)
  _orderingStep: 0, // current step on ordering page
  _orderingCompleted: [] as number[], // completed steps on ordering page
  _submitStep: 0, // current step on submit page
  _submitCompleted: [] as number[], // completed steps on submit page
};
```

The `_` prefixed fields are internal wizard state, not order data. They persist across page navigations via the same sessionStorage key.

## Verification

1. **Manual test flow**:
   - Navigate to `/client/orders/new`
   - Fill products → continue → select source → continue → select service type
   - Click "Proceed to Submit POs" → navigates to `/client/orders/new/submit`
   - Fill PO details → continue → review → submit
   - Verify order is created in database

2. **Back navigation test**:
   - From submit page, click "Back to Ordering" → returns to `/client/orders/new` with all data intact
   - From ordering page, click "Back to Orders" → returns to `/client/orders`

3. **Page refresh test**:
   - Refresh on either page → form state restores from sessionStorage

4. **Run lint**: `npm run lint`
5. **Run build**: `npm run build`
