---
layout: post
title: "Data Engineering: Data Modeling"
author: Carlos Pena
date: 2025-07-30
---

My notes about "DeepLearning.AI Data Engineering"
(It will still be updated, I'm making a dump for easy access in the future)


# C3: Data Storage and Queries

### 1. File Storage
- Represents a **hierarchical directory structure** (folders containing files).
- Files are typically **modified in place** (mutable).
- Users and systems can **navigate** directories using standard paths.
- Commonly built on top of **block storage** for performance.

> 🧠 Used for: operating systems, shared drives, and application-level file systems.

---

### 2. Block Storage
> **Concept:** Files are divided into small, fixed-size blocks; each block is tracked in a lookup table.

- Designed for **high-speed, low-latency access**.
- Optimized for **frequent reads and writes**.
- Best suited for **OLTP (Online Transaction Processing)** workloads.
- Underlies most **virtual machine disks**, e.g. AWS **EBS for EC2**.

> ⚙️ Typical use cases: databases, application servers, and transactional systems.

---

### 3. Object Storage (e.g., Amazon S3)
> **Concept:** Stores immutable data objects, each addressed by a unique key instead of a file path.

- Objects are **immutable**: updates require **re-writing the entire file** (versioning supported).
- Keys are **flat identifiers**, not hierarchical directories.
- Scales **horizontally** with high durability and parallel access.
- Ideal for **OLAP**, **data lakes**, and **machine learning pipelines** (text, video, audio, etc.).
- Poor fit for **transactional workloads** or random writes.

> ⚙️ Examples: AWS S3, Google Cloud Storage, Azure Blob Storage.

---

### 4. Distributed Storage Systems

- Provide **fault tolerance** and **high durability** via replication and partitioning.
- **Replication:** Copies the same data across multiple nodes.
- **Partitioning (Sharding):** Splits data into smaller chunks distributed across nodes.
- Most modern systems implement **both**.

## The CAP Theorem
> A distributed system can only fully guarantee **two** of the following three:

| Property | Description |
|-----------|--------------|
| **Consistency (C)** | Every read reflects the most recent write (ACID-like). |
| **Availability (A)** | Every request receives a response (even if outdated). |
| **Partition Tolerance (P)** | The system remains operational despite network failures. |

- **ACID systems → CP (Consistency + Partition tolerance)**  
- **BASE systems → AP (Availability + Partition tolerance)**

## Data Access Scenarios and Storage Models

### Scenario
- Perform a `SELECT` to compute the **sum of price**.
- Data volume example:
  - 1M rows × 30 columns × 100 bytes per entry = **~3 GB**
  - I/O throughput: **200 MB/s**


### Row-Oriented Databases (SQL / OLTP)

**Use Case:** Low-latency reads/writes for transactional systems.

- All data for a query must be loaded into memory.
- Performance estimation:
  - **1M rows → ~15 seconds**
  - **1B rows → ~4 hours**
- Strength: Efficient for *point reads* and *small writes*.
- Weakness: Poor for large-scale analytical aggregations.

### Column-Oriented Databases (NoSQL / OLAP)

**Use Case:** Analytical workloads with large aggregations.

- Optimized for reading a few columns across many rows.
- Performance estimation:
  - **1B rows → ~8 minutes**
- Weakness: Inefficient for transactional workloads such as  
  `SELECT * FROM table` or frequent updates/inserts.


### Hybrid Formats: Parquet and ORC

**Definition:** Row–columnar hybrid storage formats optimized for analytics.

- Data is **partitioned into row groups** (typically 128 MB each).
- Each group is stored in a **column-wise** format.
- Each column chunk is divided into **pages**, containing:
  - Encoded values (e.g., *Run-Length Encoding*).
  - Metadata: `min`, `max`, `count`, etc.
- Excellent for **semi-structured data** and **data lakes**.


### Graph Databases

**Use Case:** Model and query complex data relationships.

**Applications:**
- Product recommendations
- Social networks
- Supply chain modeling
- Fraud detection
- RAG / Chatbot reasoning layers

**Common Implementations:**
- Neo4j
- Amazon Neptune
- Apache Jena / SPARQL

**Data Model:**
- **Node:** `( )`
- **Relationship:** `[ ]`
- **Path:** `(source_node)-[relation]->(target_node)`

---

### Example Cypher Queries

```cypher
-- Return all nodes
MATCH (n) RETURN n;

-- Count total nodes
MATCH (n) RETURN COUNT(n);

-- Return distinct labels
MATCH (n) RETURN DISTINCT labels(n);

-- Count nodes of a specific type
MATCH (n:Order) RETURN COUNT(n);

-- Show properties of one Order node
MATCH (n:Order) RETURN properties(n) LIMIT 1;

-- Compute average order value
MATCH ()-[r:ORDERS]->() 
RETURN AVG(r.quantity * r.unitPrice) AS average_price;

-- Average price per category
MATCH ()-[r:ORDERS]->()-[part:PART_OF]->(c:CATEGORY)
RETURN c.CategoryName, AVG(r.quantity * r.unitPrice) AS average_price;

-- List products in the "Meat" category
MATCH (p:Product)-[:PART_OF]->(c:Category {CategoryName: "Meat"})
RETURN p.ProductName, p.UnitPrice;

-- Find customers who bought the same product as a given customer
MATCH (c1:Customer {CustomerID: "Carlos"})-[:PURCHASED]->()-[:ORDERS]->(p:Product)
<-[:ORDERS]-()<-[:PURCHASED]-(c2:Customer)
RETURN c2.CustomerID;
```

---


# C4: Data Modeling, Transformation, and Serving

### 🧠 Warehouse vs. Lake vs. Lakehouse


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

