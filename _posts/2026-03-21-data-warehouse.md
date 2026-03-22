---
layout: post
title: "Data Engineering: Notes of Data Warehouse Toolkit"
author: Carlos Pena
date: 2026-03-07
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

# Chapter 3

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
