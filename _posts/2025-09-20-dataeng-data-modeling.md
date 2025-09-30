---
layout: post
title: "DataEng: Data Modeling"
author: Carlos Pena
date: 2025-07-30
---

# Data Modeling Notes


🔹 Denormalized Form
- **Definition:** Data with **redundancy** and often **nested structures** (e.g., JSON).  
- **Use case:** Faster reads, fewer joins, often used in analytics or document databases.  
- **Trade-off:** Storage waste + potential data inconsistency.  



## Normal Forms (Relational Modeling)

🔹 **1NF – First Normal Form**
- Each **column must be atomic** (no arrays or JSON inside a column).
- Table must have a **Primary Key (PK)**.
- **No repeating groups** of columns.  
- ✅ Example: Instead of `colors = ["red","blue"]`, explode into multiple rows.  
- 🛠 Useful tools:
  - `pd.json_normalize` → Flatten nested JSON.  
  - `pd.explode` → Convert list to multiple rows.  
  - `pd.factorize` → Encode categorical values.  


🔹 **2NF – Second Normal Form**
- Requirement: Already in 1NF.  
- Remove **partial dependencies**: no non-key column should depend only on part of a **composite key**.  
- Solution: **Split into multiple tables**.  
- ✅ Example: In a sales table keyed by `(order_id, product_id)`, the `customer_name` depends only on `order_id`. → Move customer data to a separate table.  


🔹 **3NF – Third Normal Form**
- Requirement: Already in 2NF.  
- Remove **transitive dependencies**: non-key column should not depend on another non-key column.  
- ✅ Example: If `city → state`, and `state → country`, then `city` should not sit with `country` in the same table. Normalize into separate entities.  
- Goal: Reduce redundancy, improve **referential integrity**.  


## 🔹 Star Schema (OLAP Modeling)

- **Goal:** Optimize for **analytical queries** (BI dashboards, reporting).  
- **Structure:**  
  - **Fact Table** = Business event (append-only).  
    - Grain: Prefer **atomic** (lowest-level detail).  
    - Surrogate Key: Auto-generated, meaningless but unique.  
  - **Dimension Tables** = Descriptive context (Who, What, Where, When).  
  - **Conformed Dimension:** A dimension shared across multiple fact tables.  

### Steps to Build:
1. **Choose business process:** e.g., *Sales Transactions*.  
   - Questions:  
     - Which products sell in which stores?  
     - How do sales vary by store or brand?  
2. **Declare the grain:** e.g., *Individual item in an order*.  
3. **Identify dimensions:**  
   - `dim_store` (surrogate key, store info)  
   - `dim_item` (product details)  
   - `dim_date` (calendar attributes: day, month, quarter, weekday)  
4. **Define facts (order line):**  
   - `item_quantity`, `item_price`  
   - Foreign Keys: `store_id`, `item_id`, `date_id`  
   - Natural keys: `(order_id, line_number)`  
   - Surrogate PK: e.g., `MD5(order_id + line_number)`  


## 🔹 Data Vault Modeling

- **Approach:** Agile, scalable modeling for Data Warehouses.  
- **Layers:**
  1. **Staging:** Insert-only raw data from multiple sources.  
  2. **Data Vault:**  
     - **Hubs:** Core business keys (customers, products, employees).  
       - Columns: business key, hash key, load date, record source.  
     - **Links:** Relationships between hubs (transactions, associations).  
       - Columns: hub keys, hash key, load date, record source.  
     - **Satellites:** Contextual attributes (descriptions, metrics).  
       - Columns: descriptive fields, load date, record source.  
  3. **Information Delivery:** Denormalized presentation layer (often star schema).  

- **Strengths:**  
  - Flexible for change.  
  - Historical tracking built-in.  
  - Good fit for environments with **fast-changing requirements** and/or agile.  
