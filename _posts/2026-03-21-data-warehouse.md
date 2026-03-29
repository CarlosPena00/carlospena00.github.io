---
layout: post
title: "Data Engineering: Notes of Data Warehouse Toolkit"
author: Carlos Pena
date: 2026-03-21
---

My notes about the Data Warehouse Toolkit (Kimball).

---

# Chapter 1

**Atomic Star Schema** → (optional) OLAP Cube (e.g.: product, market, date)

- OLAP Cubes typically offer more security options than RDBMSs
- OLAP Cubes may impose some constraints

A measurement event in the physical world has a one-to-one relationship to a single row in the corresponding fact table.

**Measure types:**

- **Additive** — can be summed across all dimensions (e.g.: sales amount, quantity sold)
- **Semi-additive** — can be summed across some dimensions but not all (e.g.: account balance should not be summed along the time dimension)
- **Non-additive** — should never be summed (e.g.: unit prices — use counts or weighted averages instead: `SUM(extended_sales) / SUM(quantity)`)

> You should not store redundant text in a fact table.

> In transaction fact tables, if there is no activity, the row should be absent — do not fill with zeros.

---

## Fact Table

**Types:**

| Type | Description | Zero-fill empty rows? |
|------|-------------|----------------------|
| **Transaction** | One row per event at a point in time | No — absent row means no activity |
| **Periodic Snapshot** | One row per period, regardless of activity | Yes — maintain snapshot continuity |
| **Accumulating Snapshot** | One row per process/pipeline instance, updated as milestones occur | Yes — row exists from start to finish |

**Rules:**

- Must have 2 or more foreign keys; the composite key (subset of FKs) serves as its PK
- Every table with a composite PK must be a Fact table (heuristic — bridge tables are an exception)
- Fact tables should represent many-to-many relationships
- Keep fact tables narrow — most columns should be FKs or numeric measures
- Avoid storing textual descriptions in fact tables; push them to dimension tables

**Best Practices:**

- Always declare the **grain** before choosing facts and dimensions — the grain defines what a single row represents
- Never mix facts of different granularities in the same fact table
- Use **surrogate keys** as FKs to dimension tables, not natural/operational keys
- Factless fact tables are valid — they capture events where no measurement exists (e.g.: student attendance)

---

## Dimension Table

Answers: **Who, What, Where, When, How, Why**

- Few rows, many columns
- Columns should be verbose — avoid cryptic abbreviations
- Avoid raw business operational codes (they are easy to forget)
  - Decode them and use the decoded version in reports
  - Sometimes you should report both the code and its decoded value

**Fact vs. Dimension attribute — when it's ambiguous:**

| Attribute | Description |
|-----------|-------------|
| **Fact** | A measurement that takes on many values and participates in calculations; a continuous value |
| **Dimension** | A discrete descriptive value |

> The data is only useful if it is simple to understand.

**Best Practices:**

- Every dimension table should have a **surrogate key** (a meaningless integer PK) — never use operational keys as PKs
- Always include a **Date dimension** — it is the most common and most reused dimension; build it once for the entire enterprise
- Flatten hierarchies into the dimension table (denormalize) — avoid snowflaking unless there is a compelling reason
  - Snowflaking saves storage but hurts query simplicity and BI tool usability
- Null foreign keys in fact tables should point to a **"Unknown" or "Not Applicable"** row in the dimension, never be a true NULL
- Use **Slowly Changing Dimensions (SCD)** to handle attribute changes over time:

| SCD Type | Strategy | Use when |
|----------|----------|----------|
| **Type 1** | Overwrite the old value | History doesn't matter |
| **Type 2** | Add a new row with a new surrogate key | Full history must be preserved |
| **Type 3** | Add a new column for the new value | Only current and previous value matter |

---

## Conformed Dimensions

A dimension is **conformed** when it means the same thing across multiple fact tables and data marts.

- Enables **enterprise-wide drill-across** queries (joining two fact tables via shared dimensions)
- The Date, Customer, and Product dimensions are the most common candidates for conforming
- Conformed dimensions are the foundation of the **DW Bus Architecture**

> If two fact tables share a conformed dimension, a BI tool can query both and align the results correctly — this is the integration mechanism Kimball proposes instead of a normalized enterprise model.

---

## Architecture

### Operational Source Systems
- Capture business transactions; usually little or no control from the DW team
- Maintain little historical data

### ETL System
- **Extract:** Read and understand the source data, then copy the needed data into the ETL system
- **Transform:** Clean, resolve domain conflicts, handle missing elements, parse, combine, and deduplicate
- **Load:** Target the dimensional models — normalized structures must be off-limits to user queries

**ETL Best Practices:**

- Assign surrogate keys in the ETL layer, not in the source systems
- Always load dimension tables **before** fact tables (FKs must resolve)
- Perform deduplication and data quality checks in the Transform step, not at query time
- Maintain an **audit dimension** or audit columns (`load_date`, `source_system`) on every table for traceability

### Data Presentation Area
- Organized, stored, and available for direct querying by users, report writers, and other BI tools
- Uses Star Schemas or OLAP Cubes
- Must store **detailed atomic data** — storing only summary data is unacceptable
  - Even if users rarely look at single line items on an order, they may be very interested in last week's orders or orders above a certain size
- User requirements are always unpredictable and constantly changing
- A single fact table for atomic sales metrics is preferable over separate, similar-but-slightly-different databases for Sales, Marketing, Logistics, and Finance teams

> ETL systems should be off-limits to business users — we don't want busy ETL professionals distracted by unpredictable BI queries.

---

## DW Myths

1. **"Dimensional models are only for summary data"**
   - Summary data should *complement* granular detail to improve performance for common queries — not replace it.

2. **"Dimensional models are departmental, not enterprise"**
   - Multiple business functions often want to analyze the same metrics.

3. **"Dimensional models are not scalable"**
   - Fact tables with 2 trillion rows have been reported in production.

4. **"Dimensional models are only for predictable usage"**
   - Design should center on the measurement process, not on predefined reports or analyses.

5. **"Dimensional models can't be integrated"**
   - Conformed dimensions and the Bus Architecture are precisely the integration mechanism.

---

## Agile

- DW/BI should focus on delivering business value through cross-department collaboration
- New ETL development focuses almost exclusively on delivering more fact tables, as dimensions are already sitting on the shelf, ready to go
- Some agile managers tend to create isolated data marts to move faster — **this should be avoided**

---

## Key Design Checklist

Before finalizing a dimensional model, verify:

- [ ] The grain is explicitly declared for every fact table
- [ ] All dimensions are conformed where applicable
- [ ] Surrogate keys are used on all dimension tables
- [ ] No NULL foreign keys in fact tables (use "Unknown" dimension rows)
- [ ] SCD strategy is defined for every dimension that can change
- [ ] Atomic data is stored — summary-only tables are a red flag
- [ ] ETL loads dimensions before facts
- [ ] Audit/lineage columns are present on all tables


---

# Chapter 3 - Retail

## Four-Step Dimensional Design Process

### Step 1: Select the Business Process

- A low-level activity performed by an organization: taking orders, invoicing, payments, handling service calls, registering students, etc.
- Expressed as **action verbs**
- Supported by an operational system such as a billing or purchasing system
- Business processes generate or capture key performance metrics
- Triggered by inputs and result in output metrics

### Step 2: Declare the Grain

The **grain** defines what a single row in the fact table represents — always atomic.

Examples:
- One row per scan of an individual product on a customer sales transaction
- One row per bank account per month

### Step 3: Identify the Dimensions

Answers: **Who, What, Where, When, Why, How**

- Describe how business people interpret the data resulting from the business event
- Associated with the event (date, product, customer, employee, facility)
- List all discrete, text-like attributes for each dimension

### Step 4: Identify the Facts

- Numeric, additive figures — such as quantity ordered or dollar cost amount
- Driven by user requirements and the realities of the source data

---

## Retail Case Study

**Scenario:** A grocery chain with 100 stores across 5 states, each carrying a full complement of departments (Grocery, Frozen, Dairy, Meat, etc.) and approximately 60,000 SKUs per store. Data is collected at cash registers (POS system).

| Design Step | Decision |
|-------------|----------|
| **Business Process** | Purchases at POS system |
| **Grain** | One row per individual product scanned per sales transaction |
| **Dimensions** | Date, Store, Product, Promotion, Cashier, Payment Method |
| **Facts** | Sales quantity, unit prices, discounts, sales amount, cost amount |

> If a new dimension causes additional rows, it should be disqualified or the grain must be revisited.

### Facts Detail

Sales quantity, extended discount, sales, and cost dollar amounts are **additive** across all dimensions.

**Derived facts** (e.g., Extended Gross Profit = Extended Sales − Extended Cost) are generally recommended to be stored on disk.

| Name | Description | Example |
| --- | --- | --- |
| **Regular Unit Price** | Original price per unit before any discount | $1,000 |
| **Discount Unit Price** | Discount applied per unit | $100 |
| **Net Unit Price** | Final price per unit after discount | $900 |
| **Extended Discount Dollar Amount** | Total discount for all units (discount × quantity) | $200 |
| **Extended Sales Dollar Amount** | Total revenue after discount (net price × quantity) | $1,800 |
| **Extended Cost Dollar Amount** | Total cost for all units (cost × quantity) | $1,200 |
| **Extended Gross Profit Dollar Amount** | Total profit (sales − cost) | $600 |

**Non-Additive Facts:**

- **Gross Margin** (gross profit / extended sales revenue) — cannot be summarized along any dimension; must be computed as `SUM(gross_profit) / SUM(extended_sales)` or equivalently `SUM(extended_sales - extended_cost) / SUM(extended_sales)`
- **Unit Price** — summing unit prices across any dimension is meaningless

---

### Dimension Details

#### Date Dimension

The Date dimension is typically the first and most reused dimension; usually daily-grained.

- Pre-populate **10–20 years** of dates in advance
- Include: full date description, day of the week, day number in month/year, last-day-of-month flag, month, quarter, holiday indicator, weekday indicator, etc.
- Include name columns for reporting (e.g., "Monday", "January")
- Use meaningful labels for flags (e.g., "Holiday" / "Non-Holiday" instead of Y/N or 1/0) *(I disagree — in SQL/engineering contexts, booleans or Y/N are often cleaner)*

> See [kimballgroup.com](http://kimballgroup.com) → Tools → Utilities for a pre-built Date dimension.

**Current and relative date attributes** (e.g., `is_current_date`, `is_current_month`) may have an update lag of up to one day — it is better to compute these at query time than to store them.

#### Time-of-Day

Time-of-day is typically separated from the Date dimension to avoid row explosion.

- If filtering or rolling up by time periods (15-minute intervals, hours, shifts), treat time-of-day as a full-fledged dimension table with one row per discrete period.

#### Product Dimension

- **Flatten many-to-one hierarchies** — do not normalize (no snowflaking)
- **Attributes with embedded meaning** — preserve the full value and also store the parsed sub-attributes separately (e.g., store both `"Tropicana OJ 64oz"` and individual `brand`, `size`, `flavor` columns)

**Numeric values — Attribute or Fact?**

| Signal | Put it in... |
|--------|-------------|
| Used primarily in calculations | Fact table |
| Used primarily to filter, group, or label | Dimension table |
| Serves both purposes | Both — with distinct meanings |

> Example: Standard price stored in the **fact** captures the valuation at purchase time; stored in the **dimension** it indicates the current list price.

Rule of thumb:
- Data used in calculations → **Facts**
- Data used as constraints, groups, or labels → **Dimensions**

**Drilling Down / Up:**

- **Drill down** — add more dimension columns (more detail)
- **Drill up** — remove dimension columns (aggregate)

#### Store Dimension

The Store dimension usually does not have a pre-existing source table — the team often builds it by combining multiple source systems.

**Required attributes:** city, country, city-state combination, state, zip code, selling square footage, total square footage, first open date, remodel date, store manager.

- All descriptive attributes should have meaningful labels (~10+ characters) — avoid single-character codes

> **Best Practice:** Create **role-playing views** of the Date dimension to represent different business events (e.g., order date, shipment date, delivery date). This avoids multiple joins to the same table (`JOIN dim_date d1 ... JOIN dim_date d2 ...`) and keeps queries readable.

#### Promotion Dimension

Also called the **Causal Dimension** — it describes the factors believed to cause a change in product sales.

Must include: temporary price reductions, aisle displays, newspaper ads, coupons, etc. These are typically combined into a single dimension row.

**Key business questions it enables:**

- Did products under promotion experience a sales lift? (Requires agreeing on a baseline with the business)
- Were sales transferred from regularly-priced products to discounted ones?
- Did promoted products cannibalize sales of other products?
- What was the net overall gain before, during, and after the promotion?
- Was the promotion profitable?

#### Null Foreign Keys, Null Attributes, and Null Facts

| Scenario | Recommendation |
|----------|---------------|
| Null FK in fact table | **Never allow it** — add a row in the dimension (e.g., "Not Applicable") and point the FK there |
| Null attribute in dimension | Replace with a descriptive string: "Unknown", "Not Applicable" |
| Null value in a fact column | Usually acceptable — aggregate functions (`MIN`, `MAX`, `COUNT`, `AVG`) handle NULLs correctly |

#### Payment Method Dimension

A single transaction may involve more than one payment method (e.g., cash + gift card), which would violate the grain of the sales fact table.

**Solution:** Create a separate **Payment fact table** with a finer grain — one row per payment method per transaction — rather than forcing multiple payment methods into the sales fact row.

#### Degenerate Dimensions

A degenerate dimension is a dimension key that has **no associated dimension table** — it carries no descriptive attributes beyond the identifier itself (e.g., a POS transaction number, order number, or invoice number).

- Store it directly in the fact table (no join needed)
- Useful for grouping all line items of a single transaction (market basket analysis)
- Denoted as **DD** in schema diagrams

#### Extensibility

The dimensional model is designed to accommodate change gracefully:

| Change | How to handle |
|--------|--------------|
| Add a new dimension (e.g., Frequent Shopper) | Add a new FK column to the fact table; backfill historical rows with a "Prior to Program" surrogate key |
| Add a new dimension attribute | Add a new column; fill historical rows with "Not Available" or equivalent |
| Add a new measured fact (same grain, same process) | Add a new column to the existing fact table |
| Add a new measured fact (different grain or process) | Create a new fact table |

### Factless Fact Table

**Use case:** *Which products were on promotion but did not sell?*

A Factless Fact Table contains only foreign keys — no numeric measures (or a dummy constant like `1`). It records that an event **could have happened** but carries no measurement.

**Promotion Coverage schema:**

```
promotion_coverage_fact
├── date_key        (FK)
├── product_key     (FK)
├── store_key       (FK)
└── promotion_key   (FK)
```

**Query pattern to find promoted-but-unsold products:**

1. Query `promotion_coverage_fact` → all products on promotion
2. Query `sales_fact` → all products actually sold
3. Return `(1) EXCEPT (2)`

### Surrogate Keys

Surrogate keys are artificial keys — the DW system has no dependency on the source system's key type or values, so changes to the source key have no impact.

**Fact table surrogate key** — not useful for BI queries, but has ETL benefits:

- Immediate unique identification of a row
- Enables resuming an interrupted bulk load from a known checkpoint
- Allows replacing `UPDATE` with `INSERT + DELETE` (safer in bulk ETL)
- Required when the fact table participates in a parent/child schema (rare)

### Snowflaking (Normalized Dimensions)

**Avoid it.** Snowflaking normalizes dimension tables into multiple related tables, which hurts query readability and BI tool usability.

One acceptable exception: **outrigger dimensions** — a secondary dimension attached to a dimension table (not to the fact table directly).

> Example: `Product Dimension` → `Product Introduction Date Dimension` (date, calendar month, year, fiscal year, ...)
>
> Even so, outriggers add joins and reduce readability — use them only when the size or volatility of the sub-dimension justifies it.

### Centipede Fact Table

A **Centipede Fact Table** occurs when a fact table has an excessive number of dimension foreign keys.

- Most business processes can be fully represented with fewer than 20 dimensions
- If a design reaches 25 or more dimensions, look for opportunities to consolidate using a **Junk Dimension**

**Junk Dimension** — combine several low-cardinality flags and indicators (that would otherwise each get their own FK column) into a single dimension table:

| Without Junk Dimension | With Junk Dimension |
|------------------------|---------------------|
| `is_gift_flag` (FK) | `transaction_type_key` (FK → `junk_dim`) |
| `is_rush_order_flag` (FK) | *(all flags live as columns inside `junk_dim`)* |
| `payment_status_key` (FK) | |
| `return_flag` (FK) | |

> The junk dimension contains one row per unique combination of flag values. It reduces the number of FK columns in the fact table without losing any information.



## Best Practices Summary — Chapter 3

| Practice | Why |
|----------|-----|
| Always declare the grain before choosing dimensions and facts | Prevents scope creep and mixed granularity |
| Flatten hierarchies into dimension rows | Enables drill-up/down without joins; improves BI tool usability |
| Replace NULL dimension attributes with "Unknown" or "N/A" | Avoids GROUP BY / WHERE surprises and confuses end users |
| Use descriptive text labels instead of Y/N flags | Reports are self-explanatory without lookup tables |
| Store derived facts (e.g., gross profit) on disk | Avoids repeated computation; ensures consistent results |
| Never sum non-additive facts (unit price, ratios) | Use `SUM(numerator) / SUM(denominator)` instead |
| Use a Factless Fact Table for promotion coverage | Enables "promoted but not sold" analysis |
| Store degenerate dimensions (order/transaction numbers) in the fact table | They have no attributes; a separate table would be empty |
| Pre-populate the Date dimension 10–20 years ahead | Avoids ETL failures on future dates |
| Separate time-of-day from the Date dimension | Prevents row explosion on the Date dimension |


# Chapter 4 - Inventory

## Summary

Chapter 4 extends the retail dimensional model into the **inventory supply chain**, demonstrating how the same business pipeline spawns multiple fact tables — each with its own grain, metrics, and modeling pattern.

**Core pipeline:**
```
Purchase Order → Receive Warehouse Deliveries → Warehouse Product Inventory → Store Delivery → Store Product Inventory → Retail Sales
```

**Key highlights:**

- Inventory introduces all three fact table types in a single business context: **Periodic Snapshot**, **Transaction**, and **Accumulating Snapshot** — making it the clearest illustration of when to use each
- `quantity_on_hand` is the canonical example of a **semi-additive fact**: valid to sum across products and stores, but meaningless to sum across time
- `SQL AVG` on semi-additive facts is a silent trap — the denominator includes all rows, not distinct dates; always aggregate per date first using a window function
- The **transaction model** (receive, ship, return, etc.) is theoretically complete but was considered too dense by Kimball; modern columnar stores have made this concern less relevant
- The **accumulating snapshot** is the right model when a process has a defined beginning, end, and pipeline milestones — it is updated in place as milestones are reached
- Chapter 4 is also where Kimball introduces the **Enterprise DW Bus Architecture** and **Bus Matrix** as the enterprise integration strategy — conformed dimensions are the "bus" that connects independent data marts without a monolithic build
- The **Shrunken Rollup Conformed Dimension** is introduced as a mechanism for fact tables that operate at a coarser grain than the base dimension (e.g., brand-level vs. SKU-level), while still conforming to it

---

- Each process has its unique metrics, unique timestamp, and unique granularity → each process spawns one or more fact tables

## Inventory Periodic Snapshot

Levels of inventory measurement taken at regular intervals, each placed as a separate row in the fact table.

**Example:** The most atomic level of detail provided by the operational inventory system is a daily inventory snapshot per product per store.

| Key | Columns |
|-----|---------|
| **Dimensions** | `date_key`, `product_key`, `store_key` |
| **Facts** | `quantity_on_hand` |

To reduce data volumes, it is common to either:
- Change the snapshot frequency, or
- Keep only the last 60 days of inventory

**Semi-additive fact:** `quantity_on_hand` cannot be aggregated over time, but can be summed across stores.

> **Caution with `AVG`:** `SQL AVG` averages over all rows returned by the query — not just the number of distinct dates.
>
> Example: 3 products × 4 stores × 7 dates → the denominator would be 84, not 7.
>
> **Correct approach:** Use a window function to first aggregate per date, then average the results — this is the most robust solution.
>
> `SUM(quantity_on_hand) / COUNT(DISTINCT date_key)` also works, but breaks silently on sparse data (if not every product has a snapshot for every date, the denominator will be wrong).


### Additional Inventory Metrics

The periodic snapshot alone is rarely sufficient — it is usually necessary to add metrics that provide meaning and insight:

- **Quantity sold / shipped**
- **Turns:** `qty_sold / qty_on_hand` *(note: the standard financial formula is `COGS (Cost of Goods Sold) / Average Inventory` — this quantity-based ratio is a simplified proxy)*
- **Number of days of supply**
- **Extended value of inventory at cost**

## Inventory Transactions

Another way to model inventory is through **inventory transactions**: receive, place, release, inspect, bin, ship, return, remove, etc.

> It is impractical to rely solely on the transaction model — it is too dense, though technically possible. *(This was more true in Kimball's era. Modern columnar stores like Snowflake, BigQuery, and Redshift handle transaction-grain tables well — the "too dense" argument is less compelling today.)*

> If measurements have different natural granularities or dimensionalities, they should belong to different fact tables.

## Inventory Accumulating Snapshot

Useful when you can identify each individual product (e.g., by serial number) to track its full lifecycle.

- Individual rows are updated as new information arrives (e.g., bin placement date)
- The process must have a clear beginning and end, with defined pipeline steps
- Useful when the business wants to analyze pipeline flow and throughput

## Enterprise Data Warehouse Bus Architecture

The **Bus Architecture** is the framework that integrates dimensional data marts across the entire organization into a cohesive enterprise warehouse — without requiring a single monolithic system.

The "bus" analogy comes from electrical engineering: multiple components plug into it independently but share a standard interface. In DW terms, **conformed dimensions** and **conformed facts** serve as that shared interface.

**Key properties:**

- Each business process is built as an independent data mart
- All marts conform to shared dimensions — enabling drill-across queries
- The enterprise view emerges incrementally, mart by mart
- No big-bang monolithic build required

**Drill-across:** When two fact tables share a conformed dimension, a BI tool can query both and align results on that shared key — this is Kimball's integration mechanism instead of a normalized enterprise model.

### Enterprise Data Warehouse Bus Matrix

The **Bus Matrix** is the master planning document for the entire DW/BI system — the most important artifact to create before building anything.

**Structure:**

| Business Process | Date | Customer | Product | Employee | Store | Promotion |
|---|---|---|---|---|---|---|
| Sales Orders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Inventory | ✓ | | ✓ | | ✓ | |
| HR Payroll | ✓ | | | ✓ | ✓ | |
| Marketing Spend | ✓ | ✓ | ✓ | | | ✓ |

- **Rows** = business processes (each becomes one or more fact tables)
- **Columns** = dimensions
- **Checkmark** = this dimension participates in this business process

**What it reveals:**

- **Integration opportunities** — columns with many checkmarks are candidates for conformed dimensions
- **Scope boundaries** — rows define what each data mart covers and help prioritize build order
- **Missing conformance** — if two rows use "Customer" but mean different things, that conflict must be resolved before building

**Variations:**

- **Opportunity/Stakeholder Matrix** — adds business stakeholders as a third axis; useful for prioritization and buy-in
- **High-level vs. Detailed** — start with one row per business process; drill into a detailed matrix with one row per fact table (transaction, periodic snapshot, accumulating snapshot)

**How to use it:**

1. Workshop rows with business stakeholders — processes come from the business, not from IT systems
2. Identify the highest-value row and build that mart first
3. Lock down shared dimensions early (`Date` and `Customer` almost always appear in row 1)
4. Revisit and expand as new processes are onboarded — the matrix is a living document

> A checkmark in the matrix is a commitment: this dimension will mean the same thing in this mart as everywhere else. That commitment is what makes drill-across queries possible.

**Common Mistakes:**

- Overly excessive rows
- Report-centric, the matrix row should reference the business process
- Overly generalized column
- Separate columns for each level of hierarchy: Should always be in more granular

### Shrunken Rollup Conformed Dimension

A **shrunken rollup conformed dimension** is a higher-grain version of a base conformed dimension that contains a **subset of rows and a subset of attributes** — and still conforms to it.

It exists to serve fact tables that operate at a coarser grain than the base dimension (e.g., a Marketing Spend fact table at brand level, while the base `Product` dimension is at SKU level).

**Conformance rules — a shrunken dimension conforms when:**

1. **Attribute subset** — every column in the shrunken dimension also exists in the base dimension with the same name and meaning
2. **Row subset** — every row corresponds to one or more rows in the base dimension (it is a rollup, not an arbitrary filter)

> Renaming a column or redefining its meaning in the shrunken version breaks conformance — drill-across queries will produce incorrect results.

**Example:**

Base `Product` dimension (SKU-level grain):

| product_key | sku | product_name | brand | category | department |
|---|---|---|---|---|---|
| 1 | SKU-001 | Tropicana OJ 64oz | Tropicana | Juice | Beverages |
| 2 | SKU-002 | Minute Maid OJ 64oz | Minute Maid | Juice | Beverages |

Shrunken rollup `Brand` dimension (brand-level grain):

| brand_key | brand | category | department |
|---|---|---|---|
| 10 | Tropicana | Juice | Beverages |
| 11 | Minute Maid | Juice | Beverages |

**Do not remove attributes from the base dimension** — the shrunken rollup is an addition, not a replacement. The `Product` dimension keeps all its columns.

**Physical table or view?**

| Situation | Use |
|---|---|
| All rollup attributes come from the base dimension | View (`CREATE VIEW brand_dim AS SELECT DISTINCT ...`) |
| Rollup has its own attributes or its own source system | Physical table |
| Rollup is queried heavily at scale | Physical table (for performance) |

Prefer a view — it stays in sync automatically and guarantees conformance by definition. Only materialize into a physical table when there is a concrete reason to do so.

**In the Bus Matrix**, a shrunken rollup is annotated with a partial or shaded checkmark to indicate the business process uses a rolled-up version of a shared dimension, not the full atomic one.

---

## Best Practices Summary — Chapter 4

| Practice | Why |
|----------|-----|
| Model each business process as its own fact table | Each process has a unique grain, timestamp, and metrics — mixing them corrupts the grain |
| Choose the right fact table type per process | Periodic Snapshot for regular level measurements; Transaction for discrete events; Accumulating Snapshot for pipeline lifecycles |
| Zero-fill periodic snapshots for inactive products | Maintains continuity for time-series calculations; absence of a row implies missing data, not zero inventory |
| Never sum `quantity_on_hand` across time | It is semi-additive — summing over dates produces meaningless totals |
| Never use `SQL AVG` directly on semi-additive facts | The denominator counts all rows, not distinct dates — aggregate per date first using a window function |
| Use `SUM(qty) / COUNT(DISTINCT date_key)` only on dense data | Breaks silently on sparse snapshots where not every product has a row for every date |
| Add enrichment metrics beyond `quantity_on_hand` | Turns, days of supply, extended cost at inventory — raw on-hand quantity alone provides little business insight |
| Use the correct Turns formula for financial reporting | `COGS / Average Inventory`, not `qty_sold / qty_on_hand` — the quantity ratio is only a simplified operational proxy |
| Do not rely solely on the transaction model for inventory | Too granular for most analytical queries; combine with a periodic snapshot for level-based analysis |
| Use the accumulating snapshot only for processes with a defined start, end, and milestones | It is updated in place — unsuitable for open-ended or unbounded processes |
| Build the Bus Matrix before writing any code | It is the master planning artifact — defines scope, surfaces conformance conflicts, and aligns business and IT |
| Derive Bus Matrix rows from business processes, not reports or IT systems | Report-centric rows produce a matrix that is hard to maintain and impossible to conform |
| Use the most granular grain in the Bus Matrix columns | One column per hierarchy level inflates the matrix; roll hierarchy levels into the dimension, not into separate columns |
| Implement shrunken rollup dimensions as views when possible | A view stays in sync with the base dimension automatically and guarantees conformance by definition |
| Never rename or redefine attributes in a shrunken rollup | Doing so breaks conformance — drill-across queries on that attribute will produce incorrect results |
