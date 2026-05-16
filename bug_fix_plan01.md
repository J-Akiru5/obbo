# LikasLens Bug Fixes – 5 Issues

Comprehensive fix for 5 reported bugs across the admin and client portals.

## Proposed Changes

### Bug #1: Dynamic Sidebar Notification Badges
**Root Cause:** Lines 181-190 in [layout.tsx](file:///S:/Dev/Monorepo/obbo/src/app/admin/layout.tsx#L181-L190) — "Orders" badge is hardcoded to `2`, "Clients" badge is hardcoded to `2`.

#### [MODIFY] [layout.tsx](file:///S:/Dev/Monorepo/obbo/src/app/admin/layout.tsx)
- **Add state:** `pendingOrderCount` and `pendingKycCount` in `AdminLayout`.
- **Fetch counts on mount:** Query `orders` table `count` where `status IN ('pending', 'awaiting_check', 'pending_final_confirmation')` for orders badge, and `profiles` table `count` where `kyc_status = 'pending_verification' AND role = 'client'` for clients badge.
- **Subscribe to real-time changes** on both tables to auto-update counts.
- **Pass counts** to `SidebarContent` as props.
- **Replace hardcoded `2`s** with the dynamic counts. Only show badge if count > 0.

---

### Bug #2: Searchable Client Dropdown for Manual PO
**Root Cause:** Line 331-332 in [po-list-tab.tsx](file:///S:/Dev/Monorepo/obbo/src/app/admin/inventory/components/po-list-tab.tsx#L330-L332) — The "Client Name" field is a plain `<Input>` with no relationship to verified clients.

#### [MODIFY] [po-list-tab.tsx](file:///S:/Dev/Monorepo/obbo/src/app/admin/inventory/components/po-list-tab.tsx)
- **Add state:** `clients` list fetched from `profiles` table where `role = 'client' AND kyc_status = 'verified'`.
- **Add state:** `clientSearch` for search input, `clientId` for selected client ID.
- **Fetch clients on dialog open** (both create and edit).
- **Replace** plain `<Input>` for Client Name with a `Popover`+`Command` combo (we already have `cmdk` installed) that:
  - Shows a searchable list of verified clients
  - Displays `company_name || full_name`
  - Stores both `client_name` and `client_id` for the PO record
- **Update `createPurchaseOrder`** call to also pass `client_id`.

#### [MODIFY] [admin-actions.ts](file:///S:/Dev/Monorepo/obbo/src/lib/actions/admin-actions.ts)
- Add `client_id` to the `createPurchaseOrder` and `updatePurchaseOrder` parameter types so the PO is linked to the actual client profile.

---

### Bug #3: Required Fields — PO Number & PO Photo
**Root Cause:** Lines 326 and 412 in [po-list-tab.tsx](file:///S:/Dev/Monorepo/obbo/src/app/admin/inventory/components/po-list-tab.tsx) — PO Number is labeled "(Optional)" and PO Photo is labeled "(optional)". No validation blocks submission.

#### [MODIFY] [po-list-tab.tsx](file:///S:/Dev/Monorepo/obbo/src/app/admin/inventory/components/po-list-tab.tsx)
- **Update labels**: Remove "(Optional)" from PO Number, add red `*` required indicator. Same for PO Photo.
- **Add validation** in `handleSubmit`:
  - Check `if (!poNumber.trim())` → show toast error "PO Number is required."
  - Check `if (!photoFile && !editingPo?.photo_url)` → show toast error "PO Photo is required." (only block if no existing photo on edit)
- **Remove** auto-generation note text (but keep auto-generation as backend fallback; frontend now enforces it).

---

### Bug #4: Check Payment Details Not Reflecting in Fulfillment
**Root Cause:** The [fulfillment-tab.tsx](file:///S:/Dev/Monorepo/obbo/src/app/admin/orders/components/fulfillment-tab.tsx) only shows `po_image_url` (line 177-180) but never displays `check_image_url`, `check_number`, or `payment_method`. When a client uploads check details, the data is correctly saved via `submitPaymentDetails` and confirmed via `finalConfirmCheck` — the order transitions properly to `approved`/`partially_approved` and appears in fulfillment. The problem is the fulfillment UI doesn't **display** the check information, giving the appearance that it "doesn't reflect."

#### [MODIFY] [fulfillment-tab.tsx](file:///S:/Dev/Monorepo/obbo/src/app/admin/orders/components/fulfillment-tab.tsx)
- **Add a check payment info section** below the PO link for each order card, showing:
  - Payment method badge (Check vs Cash)
  - If check: check number, link to view check image (`check_image_url`)
  - Total amount
- This makes the check upload visible throughout the fulfillment flow, confirming to warehouse staff that payment was submitted.

---

### Bug #5: Remove "Save as Draft" from Client Ordering
**Root Cause:** Lines 646-649 in [catalog-client.tsx](file:///S:/Dev/Monorepo/obbo/src/app/client/catalog/components/catalog-client.tsx) contain the "Save as Draft" button. Lines 230-297 contain the `handleSaveDraft` function. Line 7 imports `saveOrderDraft`, line 18 imports `Save` icon, line 59 defines `isSavingDraft` state.

#### [MODIFY] [catalog-client.tsx](file:///S:/Dev/Monorepo/obbo/src/app/client/catalog/components/catalog-client.tsx)
- **Remove** the `handleSaveDraft` function (lines 230-297).
- **Remove** the "Save as Draft" `<Button>` from DialogFooter (lines 646-649).
- **Remove** `isSavingDraft` state variable (line 59).
- **Remove** `saveOrderDraft` from import (line 7).
- **Remove** `Save` from lucide-react import (line 18).
- **Clean up** the Cancel and Submit buttons — remove `isSavingDraft` disabled conditions.

> [!NOTE]
> The server-side `saveOrderDraft`, `fetchDraftOrders`, and `deleteDraftOrder` functions in `client-actions.ts` will be kept for now (dead code cleanup can happen in a later sprint). This minimizes risk.

---

## Verification Plan

### Automated Tests
- `npm run build` — Ensure no TypeScript compilation errors after all changes.

### Manual Verification
- **Bug 1:** Navigate to admin sidebar → badge numbers should dynamically reflect actual pending order/KYC counts and update in real-time.
- **Bug 2:** Go to Inventory → PO List → Add Manual PO → Client field should be a searchable dropdown showing only verified clients.
- **Bug 3:** Try creating a PO without PO Number or PO Photo → should see validation error toasts.
- **Bug 4:** Complete a check payment flow → check details should be visible in the Fulfillment tab.
- **Bug 5:** Open catalog → place an order → "Save as Draft" button should no longer be visible.
