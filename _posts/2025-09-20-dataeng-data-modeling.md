---
layout: post
title: "DataEng: Data Modeling"
author: Carlos Pena
date: 2025-07-30
---

# Data Engineering

My notes about "DeepLearning.AI Data Engineering"
(It will still be updated, I'm making a dump for easy access in the future)

# C4: Data Modeling, Transformation, and Serving

🧠 Warehouse vs. Lake vs. Lakehouse
| Feature / Aspect    | 🏛️ **Data Warehouse**                 | 🪣 **Data Lake**                            | ⚡ **Data Lakehouse**                              |
| ------------------- | ------------------------------------- | ------------------------------------------- | -------------------------------------------------- |
| **Core Purpose**    | Centralized analytical store SQL/BI   | Raw data repository for all data types      | Unified platform combining data lake flexibility with warehouse reliability |
| **Data Type**       | Structured                            | Structured, Semi-structured, Unstructured   | Structured and Semi-structured                     |
| **Schema**          | Predefined (schema-on-write)          | Flexible (schema-on-read)                   | Hybrid: supports both                              |
| **Storage Format**  | Columnar storage (e.g., Parquet, ORC) | Object storage (e.g., S3, GCS, Azure Blob)  | Object storage with metadata layers                |
| **Performance**     | Optimized for analytical queries      | Lower performance for direct queries        | Optimized through caching and metadata             |
| **Cost**            | High (due to compute and management)  | Low (commodity storage)                     | Moderate: low storage cost with efficient compute  |
| **Scalability**     | Moderate                              | High                                        | High: scalable with compute/storage decoupling     |
| **Use Cases**       | BI, Reporting, Historical Analysis    | Data exploration, Data science, ETL staging | Unified analytics, ML, BI, real-time analytics     |
| **Management Risk** | Data Silos                            | Risk of Data Swamp (if ungoverned)          | Centralized governance, schema enforcement         |
| **Examples / Tech** | Snowflake, BigQuery, Redshift         | AWS S3, Azure Data Lake, Hadoop HDFS        | Databricks Delta Lake, Apache Iceberg, Apache Hudi |


## 🔹 Denormalized Form
- **Definition:** Data with **redundancy** and often **nested structures** (e.g., JSON).  
- **Use case:** Faster reads, fewer joins, often used in analytics or document databases.  
- **Trade-off:** Storage waste + potential data inconsistency.  


## 🔹  Normal Forms (Relational Modeling)

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



# 🔥 Apache Spark Overview

**Apache Spark** is a distributed computing framework for large-scale data processing.  
It generalizes **MapReduce** by performing operations **in-memory**, drastically reducing I/O overhead.

### Key Concepts
- **RDD (Resilient Distributed Dataset):** Immutable distributed collection of data.  
- **DataFrame:** Higher-level abstraction with schema, built on RDDs.  
- **Spark SQL:** Allows querying DataFrames using SQL syntax.  
- **Lazy Evaluation:** Transformations execute only when an action (`show()`, `collect()`, `write()`) is triggered.


## 🧩 Typed Data and Schemas

Explicit schema definition improves:
- Performance (avoids runtime type inference)
- Data consistency
- Integration with SQL/BI tools

```python
# TODO: improve this example
from pyspark.sql.types import *

schema = StructType([
    StructField("name", StringType(), True),
    StructField("age", IntegerType(), True)
])

test_df = spark.createDataFrame(list_of_tuples, schema)
test_df.show()
``` 

## 💾 Read/Writing Data to Relational Databases (JDBC)

```py
test_df.write.jdbc(
    url=jdbc_url,
    table="test_schema.test_table",
    mode="overwrite",
    properties=jdbc_properties
)

customers_df = spark.read.jdbc(
    url=jdbc_url,
    table="classicmodels.customers",
    properties=jdbc_properties
)

# used to register a DataFrame as a temporary
# SQL-queryable view within the current Spark session
customers_df.createOrReplaceTempView("customers")
``` 

## Custom SQL Functions (UDFs)

```py
from pyspark.sql.types import StringType

def titleCase(text: str):
    return ' '.join(word.capitalize() for word in text.split())

spark.udf.register("titleUDF", titleCase, StringType())
spark.sql("SELECT book_id, titleUDF(book_name) AS title FROM books")
```

## Query

```py
dim_customers_df = spark.sql("""
    SELECT 
        CAST(customerNumber AS STRING) AS customer_number,
        ...
    FROM customers
""")

# Add columns

dim_customers_df = dim_customers_df.withColumn(
    "customer_key",
    surrogateUDF(array("customer_number"))
)

# 📆 Date Dimension Generation

from pyspark.sql.functions import (
    col, explode, sequence, year, month, dayofweek, 
    dayofmonth, dayofyear, weekofyear, date_format, lit
)
from pyspark.sql.types import DateType

start_date = "2003-01-01"
end_date = "2005-12-31"

date_range_df = spark.sql(f"""
    SELECT explode(sequence(to_date('{start_date}'), to_date('{end_date}'), interval 1 day)) AS date_day
""")

date_dim_df = date_range_df \
    .withColumn("day_of_week", dayofweek("date_day")) \
    .withColumn("day_of_month", dayofmonth("date_day")) \
    .withColumn("day_of_year", dayofyear("date_day")) \
    .withColumn("week_of_year", weekofyear("date_day")) \
    .withColumn("month_of_year", month("date_day")) \
    .withColumn("year_number", year("date_day")) \
    .withColumn("month_name", date_format("date_day", "MMMM")) \
    .withColumn("quarter_of_year", get_quarter_of_year_udf("date_day"))

date_dim_df.show()

```

# 🔁 Change Data Capture (CDC) Pipeline

The CDC pipeline ensures real-time synchronization between source and target systems through event streaming.

**Flow:**
1. **SQL Database** captures row-level changes (insert/update/delete).  
2. **Debezium** streams these changes into **Kafka** topics.  
3. **Kafka** brokers the change events.  
4. **Flink** consumes from Kafka and writes updates to **PostgreSQL**.

**Technologies:**
- Source: MySQL  
- CDC Engine: Debezium  
- Event Bus: Apache Kafka  
- Stream Processor: Apache Flink  
- Target: PostgreSQL  

---

**Layers Overview**

| Layer | Technology | Purpose |
|--------|-------------|----------|
| Source | MySQL | Transactional data source |
| CDC | Debezium | Change data capture |
| Stream | Kafka | Event streaming backbone |
| Processing | Flink | Real-time transformations |
| Serving | PostgreSQL | Analytical serving store |

