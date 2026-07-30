# Sales and Profit Tracking Module

## Domain Overview

The Sales and Profit Tracking module of the OBBO iManage system calculates gross revenue and net profit per shipment batch for OBBO Holdings Inc., a cement importing/distribution business. It uses actual cost data—import costs from Vietnam and local operating costs in the Philippines—to provide financial visibility into each transaction, enabling better decision-making and operational monitoring.

## Entities & Data Points

### Shipment Batch / Order

- Selling price source (Port or Warehouse)
- Quantity of individual bags (calculated as: Jumbo Bags × 25 + Sling Bags × 50)
- Number of Jumbo Bags (JB)
- Number of Sling Bags (SB)
- Total Sales (Quantity × Selling Price)
- Gross Profit (Total Sales − (Quantity × Landed Cost))
- Net Profit (Total Sales − (Quantity × (Landed Cost + Local Expenses)))
- Shipping fee collected (tracked separately, not in profit calculations)

### Product Catalog Entry

- Selling Price (Port) — default ₱210.00
- Selling Price (Warehouse) — default ₱185.00

### Cost Configuration Entry

- Landed Cost per bag — default ₱147.64
- Local Expenses per bag — default ₱20.00

### Shipment Ledger Record

- All computed values from the order (stored for historical reporting)

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
| Duties (DTI Anti-Dumping and Safeguard) | 22.00        | Government import duties                 |
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

The wholesale selling price per 40kg bag is ₱185.00. This is derived from the standard retail price in the Philippines (₱210.00) minus a cut price or discount (₱25.00) typically given to wholesale or corporate clients.

| Component                   | Amount (PHP) |
| --------------------------- | ------------ |
| Standard retail price       | 210.00       |
| Less: Cut price (discount)  | (25.00)      |
| **Wholesale selling price** | **185.00**   |

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

| Variable | Definition                                               |
| -------- | -------------------------------------------------------- |
| Q        | Total quantity of individual 40kg bags                   |
| SP       | Selling Price per bag (₱185.00 warehouse / ₱210.00 port) |

### 3. Gross Profit

```
Gross Profit = Total Sales − (Q × LC)
```

| Variable    | Definition                             |
| ----------- | -------------------------------------- |
| Total Sales | Q × SP                                 |
| Q           | Total quantity of individual 40kg bags |
| LC          | Landed Cost per bag (₱147.64)          |

### 4. Net Profit

```
Net Profit = Total Sales − (Q × (LC + LE))
```

Or equivalently:

```
Net Profit = Total Sales − (Q × TC)
```

| Variable    | Definition                             |
| ----------- | -------------------------------------- |
| Total Sales | Q × SP                                 |
| Q           | Total quantity of individual 40kg bags |
| LC          | Landed Cost per bag (₱147.64)          |
| LE          | Local Expenses per bag (₱20.00)        |
| TC          | Total Cost per bag = LC + LE (₱167.64) |

### 5. Profit Relationship

```
Gross Profit = Net Profit + (Q × LE)
```

Equivalently:

```
Gross Profit = Net Profit + Local Expenses (total)
```

## Glossary

| Term                        | Definition                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Landed Cost**             | Total cost to bring cement from the Vietnam supplier to the Philippine port (₱147.64 per bag).                |
| **Local Expenses**          | All operational costs incurred after the cement arrives in the Philippines (₱20.00 per bag).                  |
| **Total Cost**              | Sum of landed cost and local expenses (₱167.64 per bag).                                                      |
| **Wholesale Selling Price** | Price at which cement is sold to wholesale/corporate clients (₱185.00 per bag).                               |
| **Standard Retail Price**   | The public retail price in the Philippines (₱210.00 per bag).                                                 |
| **Cut Price / Discount**    | Deduction from retail price for wholesale clients (₱25.00 per bag).                                           |
| **Gross Profit**            | Total Sales minus landed cost only; profit before local operating expenses.                                   |
| **Net Profit**              | Total Sales minus total cost (landed + local); actual profit the company keeps.                               |
| **Jumbo Bag (JB)**          | A unit of 25 individual 40kg bags (1 Metric Ton).                                                             |
| **Sling Bag (SB)**          | A unit of 50 individual 40kg bags (2 Metric Tons).                                                            |
| **Shipment Batch**          | A single order or dispatch for which profit is calculated and stored.                                         |
| **Shipping Fee**            | A pass-through cost collected from clients and paid to delivery providers; excluded from profit calculations. |
| **Cost Configuration**      | System module holding configurable landed cost and local expense values.                                      |
| **Product Catalog**         | System module holding configurable selling prices (Port and Warehouse).                                       |
| **Shipment Ledger**         | Persistent record of computed profit values per order for historical reporting.                               |

## Open Questions / Ambiguities

1. **Cut price definition ambiguous**: The document states wholesale price is "standard retail price minus a cut price or discount (₱25.00)." The term "cut price" is used interchangeably with "discount" but is not defined in the glossary or cost structure as its own configurable item. Is the ₱25.00 cut price a hardcoded constant, derived from another table, or independently configurable?

2. **Port vs. Warehouse selling price selection**: The doc states the system "Retrieves the selling price from the Product Catalog (based on the selected source: Port or Warehouse)." It is unclear what criteria or business rule determines which source is "selected" for a given order. The doc lists Port price as ₱210.00 and Warehouse price as ₱185.00, but does not specify whether ₱210.00 is the Standard Retail Price used for non-wholesale sales or a separate price tier.

3. **Net profit formula appears complete — no cut-off text**: The Net Profit formula and all sample calculations are fully written out with no trailing or incomplete formula text. (Reviewer note: source document is intact for the profit section.)

4. **Cost components are not sub-totaled individually**: The individual cost component amounts (85.80 + 27.84 + 22.00 + 12.00) sum to exactly 147.64 — no rounding discrepancy. The local expenses (10.00 + 4.00 + 3.00 + 3.00) sum to exactly 20.00 — no discrepancy.

5. **Unit weight assumption**: The doc refers to "40kg cement bag" consistently but also states "25 bags = 1 Metric Ton." 25 × 40 kg = 1,000 kg = 1 Metric Ton — internally consistent.

6. **Shipping fee tracking**: The doc specifies that the shipping fee is "shown separately in the order breakdown" but does not define a Shipping Fee entity or table structure. The data model for shipping fees is not specified.

7. **Historical immutability**: The doc states "Changes to these values affect only new orders placed after the change. Historical orders retain their original profit calculations." This implies a snapshot/copy-on-create pattern, but the exact mechanism (stored calc vs. versioned config reference) is not specified.

8. **"Sales Solution" scope**: The doc frames this as fulfilling the system's title as a "Sales Solution," suggesting this module may be the primary or only sales-related feature. The reviewer should verify whether other sales modules exist beyond profit tracking.
