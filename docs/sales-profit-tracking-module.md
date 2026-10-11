# Sales and Profit Tracking Module

## Domain Overview

The Sales and Profit Tracking module of the OBBO iManage system calculates gross revenue and net profit per shipment batch for OBBO Holdings Inc., a cement importing/distribution business. It uses actual cost data—import costs from Vietnam and local operating costs in the Philippines—to provide financial visibility into each transaction, enabling better decision-making and operational monitoring.

## Entities & Data Points

### Shipment Batch / Order

- Selling price source (Port or Warehouse)
- Quantity of individual bags (calculated as: Jumbo Bags × 25 + Sling Bags × 50)
- Number of Jumbo Bags (JB)
- Number of Sling Bags (SB)
- Total Sales (Quantity × Selling Price) — the actual amount sold for
- Gross Profit (Quantity × (Profit Basis Price − Landed Cost)) — a fixed per-bag margin, independent of the selling price
- Net Profit (Gross Profit − (Quantity × Local Expenses))
- Shipping fee collected (tracked separately, not in profit calculations)

### Product Catalog Entry

- Selling Price (Port) — configurable per product
- Selling Price (Warehouse) — configurable per product

The selling prices drive **Total Sales only**. They no longer feed Gross Profit or Net Profit. The Port default of ₱210.00 documented here previously is withdrawn: the system does not define fixed Port/Warehouse prices, and that figure does not appear in the catalog seed.

### Cost Configuration Entry

- Landed Cost per bag — default ₱147.64
- Local Expenses per bag — default ₱20.00
- Reference Price per bag — default ₱185.00 (`reference_price_per_bag` in `admin_settings.cost_config`). The price Gross and Net are measured at. Margin per bag = Reference Price − Landed Cost, so it follows landed-cost changes automatically.

### Shipment Ledger Record

- All computed values from the order (stored for historical reporting)
- Source (Port or Warehouse) — a display label showing where the order came from; it never influences price, sales, gross or net. Empty (shown as "—") when it could not be resolved.
- Profit Basis Price per bag (`profit_basis_price_per_bag`) — the per-bag price this row's margin was measured at. Empty on **legacy** rows written before the fixed-margin change, whose Gross/Net were derived from the selling price and are deliberately not restated.

### Cost Components (Landed Cost sub-entities)

- Base cost per bag
- Freight
- Duties (DTI Anti-Dumping and Safeguard)
- Port Handling

### Cost Components (Local Expenses sub-entities)

- Local delivery and fuel
- Warehouse rent and labor
- Forklift drivers and coworkers
- Local business taxes and office expenses

## Cost Structure

### Landed Cost (₱147.64 per bag)

Total cost to bring cement to the Philippine port.

| Cost Component                          | Amount (PHP) | Description                              |
| --------------------------------------- | ------------ | ---------------------------------------- |
| Base cost per bag                       | 85.80        | Cost of cement from Vietnam supplier     |
| Freight                                 | 27.84        | Transport cost from Vietnam to PH port   |
| Duties (DTI Anti-Dumping and Safeguard) | 22.00        | Government import djhuties               |
| Port Handling                           | 12.00        | Fees for handling at the Philippine port |
| **Total Landed Cost**                   | **147.64**   | Total cost to bring cement to PH port    |

### Local Expenses (₱20.00 per bag)

The local expenses represent all operational costs incurred after the cement arrives in the Philippines.

| Cost Component                           | Amount (PHP) | Description                         |
| ---------------------------------------- | ------------ | ----------------------------------- |
| Local delivery and fuel                  | 10.00        | Transport from port to warehouse    |
| Warehouse rent and labor                 | 4.00         | Storage and personnel costs         |
| Forklift drivers and coworkers           | 3.00         | Loading and dispatch labor          |
| Local business taxes and office expenses | 3.00         | Permits, accounting, staff salaries |
| **Total Local Expenses**                 | **20.00**    | Total local operating cost per bag  |

### Total Cost Per Bag

| Cost Category  | Amount (PHP) |
| -------------- | ------------ |
| Landed Cost    | 147.64       |
| Local Expenses | 20.00        |
| **Total Cost** | **167.64**   |

## Pricing

Selling prices are configured per product for each source (Port and Warehouse) in the Product Catalog and can differ between the two. They determine **Total Sales** — what the client is actually charged.

**Gross and Net are not computed from the selling price.** They are a fixed margin per bag measured at the **Reference Price** (default ₱185.00 — originally derived as the ₱210.00 standard retail price less a ₱25.00 wholesale cut price). A ₱185.00 sale and a ₱180.00 sale of the same quantity therefore report identical Gross and Net.

| Component (per 40kg bag) | Amount (PHP) |
| ------------------------ | ------------ |
| Reference Price          | 185.00       |
| Less: Landed Cost        | (147.64)     |
| **Gross margin per bag** | **37.36**    |
| Less: Local Expenses     | (20.00)      |
| **Net margin per bag**   | **17.36**    |

Because the reported figures are a standardized margin at the Reference Price, they are not the cash profit of an individual sale: a ₱180.00 sale earns ₱5.00 less per bag in cash than the figure shown.

## Formulas

### 1. Total Quantity (individual bags)

```
Q = (JB × 25) + (SB × 50)
```

| Variable | Definition                             |
| -------- | -------------------------------------- |
| Q        | Total quantity of individual 40kg bags |
| JB       | Number of Jumbo Bags ordered           |
| SB       | Number of Sling Bags ordered           |

### 2. Total Sales

```
Total Sales = Q × SP
```

| Variable | Definition                                                                                 |
| -------- | ------------------------------------------------------------------------------------------ |
| Q        | Total quantity of individual 40kg bags                                                     |
| SP       | Selling Price per bag, from the Product Catalog for the order's source (Port or Warehouse) |

### 3. Gross Profit

```
Profit Basis Price (BP) = round2(RP × F)
Gross Profit            = Q × (BP − LC)
```

For a normally recognized sale (F = 1) this is simply:

```
Gross Profit = Q × (RP − LC)        e.g. 100 bags → 100 × 37.36 = 3,736.00
```

| Variable | Definition                                                                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q        | Total quantity of individual 40kg bags                                                                                                                                       |
| RP       | Reference Price per bag (₱185.00, configurable)                                                                                                                              |
| LC       | Landed Cost per bag (₱147.64)                                                                                                                                                |
| F        | Recognized fraction: 1 for a normal sale; 0 when the PO revenue cap zeroed the sale (a redelivery of bags already paid for); between 0 and 1 if the cap clamped it partially |
| BP       | Profit Basis Price — stored on the ledger row as `profit_basis_price_per_bag`                                                                                                |

Gross Profit does **not** depend on the selling price: Total Sales is recorded as the actual amount, but the margin is measured at BP. F is what stops a ₱0 redelivery from booking the margin a second time — it books `0 − (Q × LC)` instead (100 bags → −14,764.00).

### 4. Net Profit

```
Net Profit = Gross Profit − (Q × LE)
```

Or equivalently:

```
Net Profit = Q × (BP − TC)          e.g. 100 bags → 100 × 17.36 = 1,736.00
```

| Variable     | Definition                             |
| ------------ | -------------------------------------- |
| Gross Profit | Q × (BP − LC)                          |
| Q            | Total quantity of individual 40kg bags |
| LE           | Local Expenses per bag (₱20.00)        |
| TC           | Total Cost per bag = LC + LE (₱167.64) |
| BP           | Profit Basis Price (see formula 3)     |

### 5. Profit Relationship

```
Gross Profit = Net Profit + (Q × LE)
```

Equivalently:

```
Gross Profit = Net Profit + Local Expenses (total)
```

This identity holds on **every** ledger row — normal sales, ₱0 redeliveries, and the reversal rows created by returns.

### 6. Returns

A restockable return reverses the original row at its own stored basis (not at the selling price), so a sale and its full return cancel exactly:

```
Sales delta = −(R × SP)
Gross delta = −(R × BP) + (R × LC)
Net delta   = Gross delta + (R × LE)
```

where R is the number of returned bags. Waste and damage returns reverse nothing. Returning a legacy row (no stored basis) uses SP in place of BP, exactly as before.

### Worked examples (100 bags, LC 147.64, LE 20.00, RP 185.00)

| Case                                     | Total Sales | Gross      | Net        | Basis |
| ---------------------------------------- | ----------- | ---------- | ---------- | ----- |
| Warehouse sale at ₱185.00                | 18,500.00   | 3,736.00   | 1,736.00   | 185   |
| Port sale at ₱180.00                     | 18,000.00   | 3,736.00   | 1,736.00   | 185   |
| Full restockable return of the ₱180 sale | −18,000.00  | −3,736.00  | −1,736.00  | 185   |
| PO-capped redelivery                     | 0.00        | −14,764.00 | −16,764.00 | 0     |
| Legacy row (no basis) edited to ₱18,000  | 18,000.00   | 3,236.00   | 1,236.00   | —     |

### 7. Legacy rows

Rows written before the fixed-margin change have no `profit_basis_price_per_bag`. They are **not restated**: their stored Gross and Net stay as booked, and editing one recomputes it with the original formula (`Gross = Total Sales − (Q × LC)`). Only rows written afterwards use the fixed-margin formulas above.

## Glossary

| Term                        | Definition                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Landed Cost**             | Total cost to bring cement from the Vietnam supplier to the Philippine port (₱147.64 per bag).                                              |
| **Local Expenses**          | All operational costs incurred after the cement arrives in the Philippines (₱20.00 per bag).                                                |
| **Total Cost**              | Sum of landed cost and local expenses (₱167.64 per bag).                                                                                    |
| **Wholesale Selling Price** | Price at which cement is sold to wholesale/corporate clients (₱185.00 per bag by default).                                                  |
| **Standard Retail Price**   | The public retail price in the Philippines (₱210.00 per bag).                                                                               |
| **Cut Price / Discount**    | Deduction from retail price for wholesale clients (₱25.00 per bag).                                                                         |
| **Reference Price**         | The configurable per-bag price Gross and Net are measured at (₱185.00 by default). Independent of any sale's selling price.                 |
| **Profit Basis Price**      | Per-bag price a ledger row's margin was measured at: Reference Price × recognized fraction. Stored on the row; empty on legacy rows.        |
| **Recognized Fraction**     | Share of a dispatch's revenue that was actually recognized: 1 normally, 0 for a PO-capped redelivery.                                       |
| **Gross Profit**            | Fixed per-bag margin: Q × (Profit Basis Price − Landed Cost); profit before local operating expenses. Does not vary with the selling price. |
| **Net Profit**              | Gross Profit minus local expenses (Q × Local Expenses); the standardized margin the company keeps per bag.                                  |
| **Source**                  | Port or Warehouse — where an order came from. A display label on the ledger; never affects price or profit.                                 |
| **Jumbo Bag (JB)**          | A unit of 25 individual 40kg bags (1 Metric Ton).                                                                                           |
| **Sling Bag (SB)**          | A unit of 50 individual 40kg bags (2 Metric Tons).                                                                                          |
| **Shipment Batch**          | A single order or dispatch for which profit is calculated and stored.                                                                       |
| **Shipping Fee**            | A pass-through cost collected from clients and paid to delivery providers; excluded from profit calculations.                               |
| **Cost Configuration**      | System module holding configurable landed cost and local expense values.                                                                    |
| **Product Catalog**         | System module holding configurable selling prices (Port and Warehouse).                                                                     |
| **Shipment Ledger**         | Persistent record of computed profit values per order for historical reporting.                                                             |

## Open Questions / Ambiguities

1. **Cut price definition ambiguous**: The document states wholesale price is "standard retail price minus a cut price or discount (₱25.00)." The term "cut price" is used interchangeably with "discount" but is not defined in the glossary or cost structure as its own configurable item. Is the ₱25.00 cut price a hardcoded constant, derived from another table, or independently configurable?

2. **Port vs. Warehouse selling price selection**: The doc states the system "Retrieves the selling price from the Product Catalog (based on the selected source: Port or Warehouse)." It is unclear what criteria or business rule determines which source is "selected" for a given order. The Port and Warehouse selling prices are configurable per product (the earlier ₱210.00 Port / ₱185.00 Warehouse figures are not defaults in the catalog seed), and the ledger now records the order's Source as a label. Selling price no longer affects Gross or Net, so which source an order uses only changes Total Sales.

3. **Net profit formula appears complete — no cut-off text**: The Net Profit formula and all sample calculations are fully written out with no trailing or incomplete formula text. (Reviewer note: source document is intact for the profit section.)

4. **Cost components are not sub-totaled individually**: The individual cost component amounts (85.80 + 27.84 + 22.00 + 12.00) sum to exactly 147.64 — no rounding discrepancy. The local expenses (10.00 + 4.00 + 3.00 + 3.00) sum to exactly 20.00 — no discrepancy.

5. **Unit weight assumption**: The doc refers to "40kg cement bag" consistently but also states "25 bags = 1 Metric Ton." 25 × 40 kg = 1,000 kg = 1 Metric Ton — internally consistent.

6. **Shipping fee tracking**: The doc specifies that the shipping fee is "shown separately in the order breakdown" but does not define a Shipping Fee entity or table structure. The data model for shipping fees is not specified.

7. **Historical immutability**: The doc states "Changes to these values affect only new orders placed after the change. Historical orders retain their original profit calculations." This implies a snapshot/copy-on-create pattern, but the exact mechanism (stored calc vs. versioned config reference) is not specified.

8. **"Sales Solution" scope**: The doc frames this as fulfilling the system's title as a "Sales Solution," suggesting this module may be the primary or only sales-related feature. The reviewer should verify whether other sales modules exist beyond profit tracking.
