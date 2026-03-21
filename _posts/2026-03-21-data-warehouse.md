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
- **Non-additive** — should never be summed (e.g.: unit prices — use counts or averages instead)

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
