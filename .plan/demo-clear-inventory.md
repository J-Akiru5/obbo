# Plan: Clear Inventory Lists for Demo Presentation

## Context

For an upcoming panel presentation, the Inventory page (Shipment Batches, PO List, DR List) needs to show clean empty lists. All existing data must remain in the database — this is purely a UI-level hide for the demo. User accounts are untouched.

## Approach

Add a single `DEMO_MODE` boolean constant at the top of the inventory page. When `true`, the `loadData` function returns empty arrays instead of fetching from the database. One-line toggle to revert after the demo.

## File to Modify

| File                               | Change                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `src/app/admin/inventory/page.tsx` | Add `const DEMO_MODE = true` and short-circuit `loadData` to set empty arrays |

## Implementation

In `src/app/admin/inventory/page.tsx`, modify the `loadData` function:

```ts
const DEMO_MODE = true;

const loadData = async () => {
  if (DEMO_MODE) {
    setShipments([]);
    setPurchaseOrders([]);
    setDeliveryReceipts([]);
    setLoading(false);
    return;
  }
  // ... existing fetch logic unchanged
};
```

This is the only change needed. The tab components already handle empty states gracefully (they show "No shipments found", "No purchase orders found", etc.).

## Verification

1. Navigate to `/admin/inventory` — all three tabs should show empty lists
2. Other pages (Dashboard, Orders) are unaffected
3. After demo: change `DEMO_MODE` to `false` to restore all data
