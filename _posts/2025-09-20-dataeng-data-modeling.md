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

#### **Cypher Query Language (Neo4j)**

**Basic Queries:**

```cypher
-- Return all nodes in the graph
MATCH (n) RETURN n;

-- Count total nodes
MATCH (n) RETURN COUNT(n) AS total_nodes;

-- Return distinct node labels (types)
MATCH (n) RETURN DISTINCT labels(n);

-- Count nodes of specific type
MATCH (n:Order) RETURN COUNT(n) AS order_count;

-- Show properties of one Order node
MATCH (n:Order) RETURN properties(n) LIMIT 1;
```

**Aggregation Queries:**

```cypher
-- Compute average order value across all relationships
MATCH ()-[r:ORDERS]->()
RETURN AVG(r.quantity * r.unitPrice) AS avg_order_value;

-- Average price per product category
MATCH ()-[r:ORDERS]->()-[:PART_OF]->(c:Category)
RETURN c.CategoryName, AVG(r.quantity * r.unitPrice) AS avg_price
ORDER BY avg_price DESC;

-- Top 10 customers by total spending
MATCH (c:Customer)-[p:PURCHASED]->()
RETURN c.CustomerID, c.name, SUM(p.amount) AS total_spent
ORDER BY total_spent DESC
LIMIT 10;
```

**Filtering and Pattern Matching:**

```cypher
-- List products in "Meat" category
MATCH (p:Product)-[:PART_OF]->(c:Category {CategoryName: "Meat"})
RETURN p.ProductName, p.UnitPrice
ORDER BY p.UnitPrice DESC;

-- Find customers who bought the same product as "Carlos" (collaborative filtering)
MATCH (c1:Customer {CustomerID: "Carlos"})-[:PURCHASED]->()-[:ORDERS]->(p:Product)
      <-[:ORDERS]-()<-[:PURCHASED]-(c2:Customer)
WHERE c1 <> c2
RETURN DISTINCT c2.CustomerID, c2.name;

-- Find friend recommendations (friend-of-friend not already connected)
MATCH (me:Person {name: "Alice"})-[:FRIENDS_WITH]->(friend)-[:FRIENDS_WITH]->(fof)
WHERE NOT (me)-[:FRIENDS_WITH]->(fof) AND me <> fof
RETURN fof.name, COUNT(friend) AS mutual_friends
ORDER BY mutual_friends DESC;
```

**Write Operations:**

```cypher
-- Create new node with properties
CREATE (p:Product {
    country: 'US',
    description: "SmartTV",
    code: 'BWC',
    price: 599.99
}) RETURN p;

-- Create relationship between existing nodes
MATCH (a:Product {code: 'ABC'}), (b:Product {code: 'CDE'})
CREATE (a)-[r:RELATED_TO {similarity: 0.85, dist: 12}]->(b)
RETURN r;

-- Update node properties
MATCH (p:Product) WHERE p.code = 'BWC'
SET p.price = 199, p.discount = true
RETURN p;

-- Delete node and all its relationships
MATCH (p:Product)-[r]-() WHERE p.code = 'CLR'
DELETE r, p;
```

**Advanced Queries (WITH clause for aggregation pipelines):**

```cypher
-- Find products with exactly 1 related product
MATCH (p:Product)-[f:RELATED_TO]->(related:Product)
WITH p, COUNT(f) AS relation_count
WHERE relation_count = 1 AND p.code = 'RAA'
RETURN p.code, p.description, relation_count
LIMIT 10;

-- Multi-hop fraud detection: flag accounts with shared payment methods
MATCH (account1:Account)-[:USES_CARD]->(card:CreditCard)<-[:USES_CARD]-(account2:Account)
WHERE account1 <> account2
WITH account1, account2, COUNT(card) AS shared_cards
WHERE shared_cards > 2
RETURN account1.id, account2.id, shared_cards AS fraud_score
ORDER BY fraud_score DESC;
```

**Performance Optimization:**
- **Indexes:** Create on frequently queried properties (`CREATE INDEX ON :Customer(CustomerID)`)
- **Limit traversal depth:** Avoid unbounded path queries (`[:KNOWS*1..3]` for 1-3 hops)
- **Use EXPLAIN/PROFILE:** Analyze query execution plans

---

# C4: Data Modeling, Transformation, and Serving
## Modern Data Storage Architectures

### Data Warehouse vs. Data Lake vs. Data Lakehouse


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


### Normal Forms: Eliminating Redundancy

Normalization progressively eliminates redundancy and dependency anomalies to ensure data integrity.

---

#### **1NF – First Normal Form**

**Rule:** Each column contains only **atomic values** (no arrays, no nested objects), and each row is uniquely identifiable.

**Requirements:**
1. Table has a **Primary Key**
2. Each column contains **single values** (not lists or sets)
3. No **repeating groups** (e.g., `phone1`, `phone2`, `phone3` columns)

**Example Violation:**

| order_id | customer_name | products               |
|----------|---------------|------------------------|
| 1        | Alice         | ["Laptop", "Mouse"]    |

**1NF Correction:**

| order_id | customer_name | product   |
|----------|---------------|-----------|
| 1        | Alice         | Laptop    |
| 1        | Alice         | Mouse     |

**Python Tools for 1NF:**
```python
import pandas as pd

# Flatten nested JSON
df = pd.json_normalize(json_data)

# Explode lists into separate rows
df = df.explode('products')

# Encode categories as integers
df['category_id'], categories = pd.factorize(df['category'])
```

---

#### **2NF – Second Normal Form**

**Rule:** Already in 1NF + no **partial dependencies** (non-key columns must depend on the entire composite key).

**When this matters:** Tables with **composite primary keys** (e.g., `(order_id, product_id)`).

**Example Violation:**

| order_id | product_id | product_name | customer_name | order_date |
|----------|------------|--------------|---------------|------------|
| 1        | 101        | Laptop       | Alice         | 2025-01-01 |
| 1        | 102        | Mouse        | Alice         | 2025-01-01 |

**Problem:** `customer_name` and `order_date` depend only on `order_id` (partial dependency).

**2NF Correction:**

**Orders Table:**

| order_id | customer_name | order_date |
|----------|---------------|------------|
| 1        | Alice         | 2025-01-01 |

**Order_Items Table:**

| order_id | product_id | product_name |
|----------|------------|--------------|
| 1        | 101        | Laptop       |
| 1        | 102        | Mouse        |

---

#### **3NF – Third Normal Form**

**Rule:** Already in 2NF + no **transitive dependencies** (non-key columns must not depend on other non-key columns).

**Example Violation:**

| order_id | customer_name | city       | state | country |
|----------|---------------|------------|-------|---------|
| 1        | Alice         | Boston     | MA    | USA     |
| 2        | Bob           | Cambridge  | MA    | USA     |

**Problem:** `state` → `country` (transitive dependency: `order_id` → `city` → `state` → `country`)

**3NF Correction:**

**Orders Table:**

| order_id | customer_name | city_id |
|----------|---------------|---------|
| 1        | Alice         | 101     |
| 2        | Bob           | 102     |

**Cities Table:**

| city_id | city      | state | country |
|---------|-----------|-------|---------|
| 101     | Boston    | MA    | USA     |
| 102     | Cambridge | MA    | USA     |

**Benefits:**
- Eliminates update anomalies (change country once, not per order)
- Reduces storage (no duplicate state/country data)
- Enforces referential integrity via foreign keys

---

**When to Normalize vs. Denormalize:**
- **OLTP systems:** Normalize to 3NF (data integrity critical)
- **OLAP systems:** Denormalize for query performance (star schema)
- **Hybrid:** Normalize operational DB, denormalize data warehouse  


---

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

# Part 4: Real-Time Data Integration

## Change Data Capture (CDC) Pipelines

**Change Data Capture (CDC)** is a pattern for tracking and propagating database changes in real-time to downstream systems.

### Why CDC?

**Traditional Batch ETL Limitations:**
- ❌ **Latency:** Hours to days for data availability
- ❌ **Resource-intensive:** Full table scans on every run
- ❌ **No deleted records:** Can't detect deletions easily

**CDC Advantages:**
- ✅ **Real-time sync:** Sub-second latency for critical data
- ✅ **Efficient:** Captures only changed rows (incremental)
- ✅ **Complete audit trail:** Tracks inserts, updates, deletes
- ✅ **Low impact:** Leverages database transaction logs (no query load)

---

### CDC Architecture Pattern

```mermaid
[OLTP Database] → [CDC Engine] → [Event Stream] → [Stream Processor] → [Target System]
      MySQL          Debezium        Kafka           Flink/Spark        PostgreSQL/S3
```

---

### Components Explained

#### **1. Source Database (MySQL, PostgreSQL, Oracle)**
- **Transaction log (binlog/WAL):** Database writes all changes to durable log before committing
- **CDC reads log:** Non-invasive monitoring (no query overhead)
- **Captures:** INSERT, UPDATE, DELETE, schema changes

#### **2. CDC Engine (Debezium)**
- **Definition:** Open-source CDC platform that reads database logs and emits change events
- **Connectors:** MySQL, PostgreSQL, MongoDB, Oracle, SQL Server
- **Output format:** JSON/Avro messages with before/after state
- **Deployment:** Runs as Kafka Connect connector

**Example Change Event (Debezium):**
```json
{
  "before": {"id": 101, "name": "Alice", "balance": 500},
  "after": {"id": 101, "name": "Alice", "balance": 750},
  "op": "u",  // Operation: c=create, u=update, d=delete
  "ts_ms": 1705392000000,
  "source": {"db": "customers", "table": "accounts"}
}
```

#### **3. Event Stream (Apache Kafka)**
- **Purpose:** Durable, distributed message queue for change events
- **Benefits:**
  - **Decoupling:** Multiple consumers can process same events
  - **Replay:** Consumers can reprocess historical changes
  - **Buffering:** Handles spikes in write volume
- **Topic structure:** Typically one topic per table (e.g., `mysql.customers.accounts`)

#### **4. Stream Processor (Apache Flink, Spark Streaming)**
- **Purpose:** Real-time transformations, enrichment, aggregations
- **Operations:**
  - **Filter:** Route events based on conditions
  - **Transform:** Rename fields, compute derived columns
  - **Join:** Enrich with dimension data (e.g., add customer name to order)
  - **Aggregate:** Compute running totals, windowed metrics
- **Stateful processing:** Maintains state across events (e.g., session windows)

**Flink CDC Processing Example:**
```python
# Pseudocode: Flink SQL for CDC processing
CREATE TABLE customers_cdc (
    id INT,
    name STRING,
    balance DECIMAL,
    PRIMARY KEY (id) NOT ENFORCED
) WITH (
    'connector' = 'kafka',
    'topic' = 'mysql.customers.accounts',
    'format' = 'debezium-json'
);

-- Materialize current state (UPSERT semantics)
CREATE TABLE customer_snapshot (
    id INT PRIMARY KEY,
    name STRING,
    total_balance DECIMAL
) WITH (
    'connector' = 'jdbc',
    'url' = 'jdbc:postgresql://warehouse/analytics'
);

INSERT INTO customer_snapshot
SELECT id, name, balance FROM customers_cdc;
```

#### **5. Target System (Data Warehouse, Data Lake)**
- **PostgreSQL/Redshift:** Analytical queries, BI dashboards
- **S3/Delta Lake:** Long-term storage, batch analytics
- **Elasticsearch:** Full-text search, log analytics
- **Real-time dashboard:** Push metrics to monitoring systems

---

### CDC Pipeline Flow (Step-by-Step)

**Scenario:** Customer updates account balance

1. **Application writes to MySQL:**
   ```sql
   UPDATE accounts SET balance = 750 WHERE id = 101;
   ```

2. **MySQL writes to binlog:**
   - Binlog entry contains full before/after row state

3. **Debezium reads binlog:**
   - Parses binary log entry
   - Converts to JSON change event
   - Publishes to Kafka topic `mysql.customers.accounts`

4. **Kafka persists event:**
   - Event stored across multiple brokers (replicated)
   - Available to multiple consumers

5. **Flink consumes event:**
   - Reads from Kafka topic
   - Applies transformations (e.g., compute new metrics)
   - Maintains internal state (e.g., running balance)

6. **Flink writes to PostgreSQL:**
   - UPSERT operation (update if exists, insert if new)
   - Analytics database now reflects latest state

---

### CDC Use Cases

| Use Case | Description |
|----------|-------------|
| **Real-time analytics** | Keep data warehouse in sync with OLTP databases (sub-second latency) |
| **Microservices sync** | Propagate changes across service boundaries without tight coupling |
| **Caching invalidation** | Update Redis/Memcached when source data changes |
| **Search index updates** | Sync Elasticsearch with database changes for fresh search results |
| **Audit logging** | Complete change history for compliance (GDPR, SOX) |
| **Data lake ingestion** | Stream changes to S3/Delta Lake for long-term storage |

---

### CDC Implementation Example (Debezium + Kafka + PostgreSQL)

**Technology Stack:**

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Source** | MySQL 8.0 | Transactional database (binlog enabled) |
| **CDC** | Debezium 2.x | Reads MySQL binlog, publishes change events |
| **Stream** | Apache Kafka 3.x | Event backbone (durable, distributed queue) |
| **Processing** | Apache Flink 1.17 | Real-time transformations and aggregations |
| **Target** | PostgreSQL 15 | Analytical serving layer (materialized views) |
