---
layout: post
title: "Data Engineering: Aurora Postgres and DuckDB on S3 (Parquet/Iceberg)"
author: Carlos Pena
date: 2026-11-16
---

TL;DR: Keep Aurora Postgres for transactions (OLTP) and keep history/analytics in S3 as Parquet or Iceberg. DuckDB is the columnar engine on both sides:
- **Reading S3 from Aurora**: the `aurora_analytics` extension (Aurora PostgreSQL 17.11+ / 18.6+) embeds DuckDB inside Postgres. You create a foreign table over Parquet/Iceberg and query it with plain SQL, joined with your normal tables.
- **Writing Aurora data to S3**: those foreign tables are read-only, so exporting is still a job for a standalone DuckDB (EC2/ECS/Lambda) that reads Aurora and writes Parquet/Iceberg.

```
                ┌───────────────────────────────┐
  app writes →  │ Aurora Postgres               │
                │  local tables (OLTP)          │
                │  + aurora_analytics (DuckDB)  │──── read-only foreign tables ────┐
                └──────────────┬────────────────┘                                  │
                               │ postgres extension (binary COPY)                   │
                               ▼                                                    │
                ┌───────────────────────────────┐                                  │
                │ standalone DuckDB (export job)│  EC2 / ECS / Lambda / laptop      │
                └──────────────┬────────────────┘                                  │
                               │ httpfs + iceberg extensions                        │
                               ▼                                                    │
        ┌────────────────────────────────────┐                                     │
        │ S3: Parquet (Hive partitions)      │ ◄───────────────────────────────────┘
        │  or Iceberg (Glue / S3 Tables)     │  ← Athena, Spark, Snowflake... read it too
        └────────────────────────────────────┘
```

# Why not just query Aurora?

Postgres stores data **row by row**. That's perfect for `SELECT * FROM orders WHERE id = 42`, and bad for `SELECT sum(total) FROM orders GROUP BY month`, because it has to read every column of every row.

| | Aurora Postgres | DuckDB on Parquet/Iceberg |
|---|---|---|
| Storage | row-oriented pages | columnar files (read only the columns you need) |
| Best at | point lookups, many small transactions | scans, aggregations, joins over millions of rows |
| Concurrency | thousands of connections | one process (many threads) |
| Cost model | instance/ACU running all the time | pay for compute only while the query runs + S3 storage |
| Risk of heavy reports | competes with production traffic | isolated from production |

The rule of thumb: **if the query touches more than a few % of the table, it belongs to the columnar side.**

# The pieces

## Aurora Postgres

- Use the **reader endpoint** (a replica) for extraction. A full table scan on the writer competes with the application.
- **Reading** Parquet/Iceberg: the `aurora_analytics` extension (see [Path 0](#path-0-query-s3-from-inside-aurora-aurora_analytics)).
- **Writing** to S3: the `aws_s3` extension only exports/imports **CSV/text** (`aws_s3.query_export_to_s3`, `aws_s3.table_import_from_s3`), and `aurora_analytics` foreign tables are read-only. There is no `COPY ... TO 's3://...' (FORMAT parquet)` inside Aurora.
- A **snapshot export to S3** produces Parquet, but it's a full dump of a snapshot, slow and coarse (good for a one-off backfill, bad for hourly loads).

## DuckDB

An in-process analytical database (think "SQLite for analytics"). The extensions that matter here:

| Extension | What it gives you |
|---|---|
| `postgres` | `ATTACH` a Postgres database and query its tables as if they were local |
| `httpfs` | read/write `s3://` paths |
| `aws` | load credentials from the AWS credential chain (env, profile, instance role, SSO) |
| `iceberg` | read Iceberg tables, attach Iceberg REST catalogs (Glue, S3 Tables), and write to them in recent versions |

## Parquet vs Iceberg

**Parquet** is a file format. **Iceberg** is a table format: a metadata layer on top of Parquet files that adds snapshots, schema evolution and atomic commits.

| | Plain Parquet on S3 | Iceberg on S3 |
|---|---|---|
| What it is | files in folders (`dt=2026-11-16/part-0.parquet`) | Parquet files + metadata + catalog |
| Atomic writes | no (a reader can see half-written folders) | yes (a commit swaps the snapshot pointer) |
| Updates/deletes | rewrite the files yourself | supported by the format (engine support varies) |
| Schema evolution | by convention, readers must cope | tracked in metadata (add/rename/drop columns) |
| Time travel | no | query any previous snapshot |
| Partition pruning | by folder names | by metadata (hidden partitioning) |
| Catalog needed | no | yes (Glue, S3 Tables, REST catalog) |
| Good for | append-only data, one writer, simple pipelines | shared tables, multiple engines, corrections/late data |

Start with plain Parquet if the data is append-only and only your job writes it. Move to Iceberg when other teams/engines read the same table or you need updates, deletes or consistent snapshots.

# Path 0: query S3 from inside Aurora (aurora_analytics)

Since September 2026, Aurora PostgreSQL embeds DuckDB. A foreign table stores only the schema and the S3 location; when a query touches it, Postgres plans the query and hands execution to DuckDB, which reads only the byte ranges/columns it needs from S3 (predicate pushdown, column pruning) and caches hot data on the instance's local disk.

## Prerequisites

| Requirement | How |
|---|---|
| Engine version | Aurora PostgreSQL **17.11+** or **18.6+** (Serverless v2 included). Not RDS for PostgreSQL. |
| Enable the feature | DB cluster parameter group: `aurora_analytics.enabled = true` |
| S3 access | IAM role trusted by `rds.amazonaws.com`, attached with `--feature-name AuroraAnalytics` (`aws rds add-role-to-db-cluster`) and status **Active** |
| Install | `CREATE EXTENSION aurora_analytics;` in **each** database (needs `rds_superuser` or a delegated `rds_extension`) |

```sql
SELECT aurora_version();   -- errors on plain RDS for PostgreSQL
SHOW server_version;       -- 17.11+ or 18.6+
SELECT name, default_version FROM pg_available_extensions WHERE name = 'aurora_analytics';

CREATE EXTENSION aurora_analytics;   -- also creates the server aurora_analytics_server
```

If a query fails with `credential to access AWS service is unavailable`, the IAM role isn't **Active** yet.

## Parquet

An empty column list `()` infers the schema from the Parquet metadata:

```sql
CREATE FOREIGN TABLE products_parquet ()
SERVER aurora_analytics_server
OPTIONS (
    location 's3://my-lake/manually/products.parquet',   -- a file or a prefix (s3://.../products/)
    format   'parquet'                                    -- required for s3:// URIs
);

SELECT count(1) FROM products_parquet;   -- ~600k rows in my test

EXPLAIN ANALYZE
SELECT linha, count(1)
FROM products_parquet
GROUP BY linha
HAVING count(1) > 2;
```

## Iceberg

Four ways to point at an Iceberg table:

| `location` | Example | Follows new commits? |
|---|---|---|
| Glue ARN | `arn:aws:glue:us-east-1:111122223333:table/sales/orders` | yes, the catalog gives the current snapshot (`format` optional) |
| S3 Tables ARN | `arn:aws:s3tables:us-east-1:111122223333:bucket/my-bucket/table/<id>` | yes (`format` optional) |
| S3 path to the table folder | `s3://my-lake/warehouse/products/` (needs `version-hint.text`) | yes, via the hint file |
| S3 path to one `metadata.json` | `s3://.../metadata/00001-....metadata.json` | **no**, pinned to that version |

```sql
CREATE FOREIGN TABLE public.products_iceberg ()
SERVER aurora_analytics_server
OPTIONS (
    location 's3://my-lake/manually/products_iceberg/default/products/metadata/00001-<uuid>.metadata.json',
    format   'iceberg',
    region   'us-east-1'
);

EXPLAIN ANALYZE
SELECT linha, count(1)
FROM public.products_iceberg
GROUP BY linha
HAVING count(1) > 2;
```

> **Note on query plans:** running `EXPLAIN ANALYZE` as SQL works and returns the real execution details. The "Explain execution plan" button in DBeaver only shows a single **Custom Scan** node: Postgres hands the whole foreign-table part of the query to DuckDB, so the visual plan can't show the steps inside it. Run `EXPLAIN ANALYZE` as SQL to see them.

Pointing at a specific `metadata.json` is fine for an experiment, but it freezes the table at that commit: when a writer adds `00002-...metadata.json`, this foreign table keeps showing the old data. For a table that keeps changing, use the Glue or S3 Tables ARN.

Register a whole Glue database (or S3 Tables namespace) at once:

```sql
IMPORT FOREIGN SCHEMA sales
    FROM SERVER aurora_analytics_server
    INTO analytics
    OPTIONS (location 'arn:aws:glue:us-east-1:111122223333:catalog');
```

Time travel is a table option, resolved when the foreign table is created:

```sql
CREATE FOREIGN TABLE orders_yesterday ()
SERVER aurora_analytics_server
OPTIONS (
    location  'arn:aws:glue:us-east-1:111122223333:table/sales/orders',
    timestamp 'yesterday'            -- or snapshot '3847291056291847'
);
```

## Joining the lake with live data

The point of running it inside Postgres: one query mixes S3 history with the operational tables (it even sees your session's uncommitted writes).

```sql
SELECT p.linha, count(*) AS orders_today
FROM public.orders o                         -- local Aurora table
JOIN products_iceberg p ON p.sku = o.sku     -- foreign table on S3
WHERE o.created_at >= current_date
GROUP BY p.linha;
```

For latency-sensitive reads, materialize into a normal table or materialized view (with indexes):

```sql
CREATE MATERIALIZED VIEW mv_products_by_linha AS
SELECT linha, count(*) AS n FROM products_iceberg GROUP BY linha;

REFRESH MATERIALIZED VIEW mv_products_by_linha;
```

## Limitations to keep in mind

- **Read-only**: no `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/`COPY FROM`. Writing to the lake is still an external job (paths 1 and 2 below).
- **No Parquet export from inside Aurora**: `COPY ... TO 's3://...'` (DuckDB syntax) fails with `ERROR: COPY to a file is not supported` because Aurora only allows `COPY ... TO STDOUT`. Inside Aurora the only SQL export is `aws_s3.query_export_to_s3` (CSV/text, needs an IAM role with feature name `s3Export`).
- **Types**: `JSONB`, arrays, `SERIAL`, range, network, geometric and `XML` have no mapping.
- **One Region per query**, no S3 Multi-Region Access Points.
- **No system columns** (`ctid`, `xmin`...) on foreign tables.
- The local read **cache is lost on restart/failover**; the first queries after that go to S3 again.
- It runs on **your Aurora instance's CPU and memory**. Long scans on a reader also hold back vacuum on the writer (replication feedback). AWS recommends a **dedicated reader** for analytics with a `statement_timeout`, and watching `oldest_reader_feedback_xid_age` on the writer.

# Setup (standalone DuckDB for paths 1 and 2)

```bash
pip install duckdb
```

```sql
INSTALL postgres; LOAD postgres;
INSTALL httpfs;   LOAD httpfs;
INSTALL aws;      LOAD aws;
INSTALL iceberg;  LOAD iceberg;
```

## S3 credentials

Never hardcode keys. Let DuckDB use the same chain as the AWS CLI (instance role on EC2/ECS, env vars on Lambda, SSO profile on your laptop):

```sql
CREATE SECRET s3_creds (
    TYPE s3,
    PROVIDER credential_chain,
    REGION 'us-east-1'
);
```

On a laptop logged in with the newer `aws login` command, this can fail even though the AWS CLI works. See [Lessons learned](#lessons-learned-troubleshooting).

## Aurora connection

Read the password from the environment (populated at runtime from Secrets Manager, or an IAM auth token) instead of writing it in SQL:

```python
import os
import duckdb

con = duckdb.connect()
con.execute("INSTALL postgres; LOAD postgres;")
con.execute(f"""
    CREATE SECRET aurora (
        TYPE postgres,
        HOST '{os.environ["PGHOST"]}',     -- reader endpoint
        PORT 5432,
        DATABASE '{os.environ["PGDATABASE"]}',
        USER '{os.environ["PGUSER"]}',
        PASSWORD '{os.environ["PGPASSWORD"]}'
    );
""")
con.execute("ATTACH '' AS pg (TYPE postgres, SECRET aurora, READ_ONLY);")
```

`READ_ONLY` is a cheap safety net: the extraction job can't write to production by accident.

```sql
SHOW ALL TABLES;                         -- Aurora tables appear under the "pg" catalog
SELECT count(*) FROM pg.public.orders;   -- runs through DuckDB
```

How the read works: DuckDB opens a `COPY ... TO STDOUT (FORMAT binary)` against Postgres and splits big tables into **ctid ranges** read in parallel. Filters in the `WHERE` clause are pushed down to Postgres, so `WHERE updated_at > ...` uses the Aurora index.


# Path 1: Aurora → Parquet on S3

## Full export

```sql
COPY (
    SELECT
        id, customer_id, status, total,
        created_at,
        CAST(created_at AS DATE) AS dt
    FROM pg.public.orders
)
TO 's3://my-lake/raw/orders'
(FORMAT parquet, COMPRESSION zstd, PARTITION_BY (dt), OVERWRITE_OR_IGNORE);
```

Produces:

```
s3://my-lake/raw/orders/dt=2026-11-14/data_0.parquet
s3://my-lake/raw/orders/dt=2026-11-15/data_0.parquet
s3://my-lake/raw/orders/dt=2026-11-16/data_0.parquet
```

## Incremental export (watermark)

Re-exporting the whole table every hour doesn't scale. Export only what changed since the last run:

```sql
-- :last_watermark comes from your job state (a file, a DynamoDB item, a Postgres table...)
COPY (
    SELECT *, CAST(updated_at AS DATE) AS dt
    FROM pg.public.orders
    WHERE updated_at >  TIMESTAMP '2026-11-16 09:00:00'
      AND updated_at <= TIMESTAMP '2026-11-16 10:00:00'
)
TO 's3://my-lake/raw/orders_changes'
(FORMAT parquet, COMPRESSION zstd, PARTITION_BY (dt), FILENAME_PATTERN 'batch_20261116T10_{i}');
```

Things that bite with watermarks:

| Problem | Why | Fix |
|---|---|---|
| Missed rows | a transaction commits *after* you read but with an older `updated_at` | read up to `now() - 5 minutes`, not `now()` |
| Duplicates | the same row changes twice and lands in two batches | deduplicate on read (latest `updated_at` per `id`) |
| Deletes are invisible | a deleted row has no `updated_at` | soft deletes (`deleted_at`), or real CDC (logical replication / DMS) |
| No index on `updated_at` | the "incremental" query does a full scan on Aurora | `CREATE INDEX ... ON orders (updated_at)` |
| Files overwritten | same file name in two runs | unique `FILENAME_PATTERN` per batch |

Current state of each row, from a pile of change batches:

```sql
SELECT * EXCLUDE (rn) FROM (
    SELECT *, row_number() OVER (PARTITION BY id ORDER BY updated_at DESC) AS rn
    FROM read_parquet('s3://my-lake/raw/orders_changes/*/*.parquet', hive_partitioning = true)
)
WHERE rn = 1 AND deleted_at IS NULL;
```

## Reading it back

```sql
SELECT dt, count(*) AS orders, sum(total) AS revenue
FROM read_parquet('s3://my-lake/raw/orders/*/*.parquet', hive_partitioning = true)
WHERE dt BETWEEN '2026-11-01' AND '2026-11-16'   -- only those folders are listed/read
GROUP BY dt
ORDER BY dt;
```

Two kinds of pruning happen here:
1. **Partition pruning**: the `dt` filter skips whole folders.
2. **Row group pruning**: each Parquet row group has min/max statistics per column, so a filter on `customer_id` can skip row groups without downloading them. Sorting the data by that column before writing makes the statistics much more selective.

# Path 2: Aurora → Iceberg on S3

## Catalog options

Iceberg needs a catalog to know which metadata file is the current one.

| Catalog | How DuckDB connects | Notes |
|---|---|---|
| AWS Glue Data Catalog | Iceberg REST endpoint of Glue (`ENDPOINT_TYPE glue`) | shared with Athena, EMR, Redshift Spectrum |
| Amazon S3 Tables | table bucket ARN (`ENDPOINT_TYPE s3_tables`) | managed compaction and snapshot cleanup |
| Any Iceberg REST catalog | `ENDPOINT 'https://...'` | Polaris, Nessie, Lakekeeper, Unity... |
| No catalog | `iceberg_scan('s3://.../metadata/vN.metadata.json')` | read-only, you point at a metadata file by hand |

## Attach and read

S3 Tables:

```sql
ATTACH 'arn:aws:s3tables:us-east-1:123456789012:bucket/my-table-bucket'
    AS lake (TYPE iceberg, ENDPOINT_TYPE s3_tables);
```

Glue:

```sql
ATTACH '123456789012' AS lake (TYPE iceberg, ENDPOINT_TYPE glue);
```

Then it behaves like any other database:

```sql
SHOW ALL TABLES;
SELECT status, count(*) FROM lake.sales.orders GROUP BY status;
```

## Write

Recent DuckDB versions (1.4+) can create and insert into Iceberg tables in a REST catalog. Support for `UPDATE`/`DELETE`/`MERGE` is newer and still evolving, so check the release notes of the version you run.

```sql
CREATE SCHEMA IF NOT EXISTS lake.sales;

CREATE TABLE IF NOT EXISTS lake.sales.orders AS
SELECT id, customer_id, status, total, created_at, updated_at
FROM pg.public.orders
LIMIT 0;                                  -- copy the schema only

INSERT INTO lake.sales.orders
SELECT id, customer_id, status, total, created_at, updated_at
FROM pg.public.orders
WHERE updated_at >  TIMESTAMP '2026-11-16 09:00:00'
  AND updated_at <= TIMESTAMP '2026-11-16 10:00:00';
```

Each `INSERT` is one Iceberg commit = one new snapshot. Readers see either the snapshot before or the one after, never half of the batch.

## Time travel

```sql
SELECT * FROM iceberg_snapshots(lake.sales.orders);

SELECT count(*) FROM lake.sales.orders AT (VERSION => 1234567890123);
SELECT count(*) FROM lake.sales.orders AT (TIMESTAMP => TIMESTAMP '2026-11-15 00:00:00');
```

Useful for "what did the dashboard show yesterday?" and for reproducing an old report.

## Maintenance

Many small commits = many small files and many snapshots. Something has to clean up:

| Task | Why | Who does it |
|---|---|---|
| Compaction | thousands of tiny Parquet files make scans slow | S3 Tables does it automatically; with Glue, use Glue table optimizers or a Spark/Athena `OPTIMIZE` job |
| Expire snapshots | old snapshots keep old files alive (storage cost) | S3 Tables (configurable), Glue optimizers, or `expire_snapshots` in Spark |
| Remove orphan files | failed writes leave files no snapshot references | same as above |

Batch your writes (one commit per run, not one per row) and this stays cheap.

# Path 3: results back into Aurora

The opposite direction is also common: compute something heavy and serve the small result from Postgres (an API reads it with an index).

On Aurora 17.11+/18.6+ the simplest way is inside the database: `INSERT INTO ... SELECT ... FROM <foreign table>` or a materialized view (see Path 0). The standalone DuckDB version below is for older engine versions, or when you don't want the heavy aggregation to consume Aurora's CPU.

```sql
ATTACH '' AS pg_rw (TYPE postgres, SECRET aurora_writer);   -- writer endpoint, separate user

CREATE TABLE IF NOT EXISTS pg_rw.analytics.customer_ltv (
    customer_id BIGINT PRIMARY KEY,
    ltv         DECIMAL(18, 2),
    computed_at TIMESTAMP
);

BEGIN;
DELETE FROM pg_rw.analytics.customer_ltv;
INSERT INTO pg_rw.analytics.customer_ltv
SELECT customer_id, sum(total), now()
FROM lake.sales.orders
GROUP BY customer_id;
COMMIT;
```

Keep this for **small, aggregated** outputs. Pushing millions of rows back into Aurora brings back the problem we started with.

# Where to run DuckDB

| Runtime | Good for | Watch out |
|---|---|---|
| Lambda | small incremental batches, event-driven | 15 min limit, 10 GB memory, needs to reach Aurora's VPC |
| ECS Fargate task (scheduled) | hourly/daily jobs of any size | cold start of the task, pick memory for the largest batch |
| EC2 | big backfills, interactive analysis | you pay while it's on |
| Laptop | exploration with your SSO profile | don't pull production PII to your disk |

Memory: DuckDB spills to disk when a query doesn't fit (`SET temp_directory = '/tmp/duckdb'`), so the limit is soft, but give it local disk on Fargate/Lambda (`/tmp` up to 10 GB on Lambda).

```sql
SET memory_limit = '6GB';
SET threads = 4;
SET temp_directory = '/tmp/duckdb_spill';
```

# Tuning checklist

## Parquet files

- **File size**: aim for roughly 100 MB to 1 GB per file. Thousands of 50 KB files make S3 `LIST` + `GET` calls dominate the query time.
- **Compression**: `zstd` (good ratio, fast) is a safe default; `snappy` if another engine requires it.
- **Sort before writing** by the columns you filter on most (`ORDER BY customer_id, created_at`), so row group min/max stats prune well.
- **Partition by low-cardinality columns** (date, country). Partitioning by `customer_id` creates millions of folders.
- **Types**: cast `numeric` without precision to `DECIMAL(p, s)` or `DOUBLE` explicitly. Postgres `numeric` with no scale becomes a wide type that other engines handle badly.

## Aurora side

- Extract from the **reader**, not the writer.
- Index the watermark column.
- Long reads on a replica can conflict with replication; keep each extraction query short (bounded time windows) rather than one 2-hour scan.
- Give the extraction job its own database user with `SELECT` only on the tables it needs.

## Security

- S3: bucket encryption (SSE-KMS), block public access, and IAM policies that grant the job only its prefix (`s3://my-lake/raw/orders/*`).
- Aurora: credentials from Secrets Manager or IAM database authentication, never in code or SQL files.
- PII: drop or hash columns you don't need in the lake (`email`, `cpf`, `phone`) **in the extraction query**, before they reach S3.

# Full example (end to end)

One DuckDB session that reads a table from Aurora, transforms it and writes partitioned Parquet to S3. Run it all in the **same** session (extensions and secrets don't carry over to a new one).

Before starting DuckDB, make sure the CLI has a valid login and that the `duckdb` profile exists (see [DuckDB + `aws login`](#duckdb--aws-login)):

```bash
aws login                                   # or: aws sso login --profile ...
aws sts get-caller-identity                 # the account that owns the bucket?
duckdb
```

```sql
-- 1. Extensions (once per session)
INSTALL postgres; LOAD postgres;
INSTALL httpfs;   LOAD httpfs;
INSTALL aws;      LOAD aws;

-- 2. Aurora connection (placeholders: never commit real values)
CREATE OR REPLACE SECRET aurora (
    TYPE postgres,
    HOST 'my-cluster.cluster-ro-xxxx.us-east-1.rds.amazonaws.com',   -- reader endpoint
    PORT 5432,
    DATABASE 'postgres',
    USER 'duckdb_reader',
    PASSWORD '<from Secrets Manager / IAM auth token>'
);

ATTACH '' AS pg (TYPE postgres, SECRET aurora, READ_ONLY);

-- 3. S3 credentials through the AWS CLI
CREATE OR REPLACE SECRET s3_creds (
    TYPE s3,
    PROVIDER credential_chain,
    CHAIN 'process',
    PROFILE 'duckdb',
    REGION 'us-east-1'
);

-- 4. Read from Aurora, transform, write Parquet partitioned by linha
COPY (
    SELECT
        linha,
        codigo,
        upper(descricao) AS descricao
    FROM pg.public.products_parquet
)
TO 's3://my-lake/manually/test_write_duckdb/'
(
    FORMAT parquet,
    COMPRESSION zstd,
    PARTITION_BY (linha),
    WRITE_PARTITION_COLUMNS true,   -- keep linha inside the files too (see below)
    OVERWRITE_OR_IGNORE
);

-- 5. Check what was written
SELECT linha, count(*) AS n
FROM read_parquet('s3://my-lake/manually/test_write_duckdb/*/*.parquet', hive_partitioning = true)
GROUP BY linha
ORDER BY n DESC;
```

Result on S3:

```
s3://my-lake/manually/test_write_duckdb/linha=AAAA/data_0.parquet
s3://my-lake/manually/test_write_duckdb/linha=.../data_0.parquet
```

## Reading the output back in Aurora

By default, DuckDB's `PARTITION_BY` **removes the partition column from the files**: `linha` exists only in the folder name (`linha=AAAA/`). DuckDB puts it back when you read with `hive_partitioning = true`, but other readers may not. A reader that ignores the folder names (Hive partitioning) sees files with only `codigo` and `descricao`.

`WRITE_PARTITION_COLUMNS true` writes `linha` into every file as well. It costs almost nothing (the column has a single value per file, so it compresses to a few bytes) and makes the files self-contained for any engine.

Then point a foreign table at the **prefix**, not at one file:

```sql
-- in Aurora
CREATE FOREIGN TABLE products_from_duckdb ()
SERVER aurora_analytics_server
OPTIONS (
    location 's3://my-lake/manually/test_write_duckdb/',
    format   'parquet'
);

\d products_from_duckdb                 -- linha should be in the inferred columns

SELECT linha, count(*) FROM products_from_duckdb GROUP BY linha;
```

If `linha` is missing from `\d`, the files were written without `WRITE_PARTITION_COLUMNS` and the foreign table doesn't read the folder names: rewrite them with the option on.

Notes:
- `products_parquet` here is the `aurora_analytics` foreign table from Path 0, so the data goes S3 → Aurora → DuckDB → S3. That's fine for a test; in a real pipeline, read the S3 source directly with `read_parquet` and use Aurora only for the tables that live in Aurora.
- DuckDB reads big Postgres tables in parallel by `ctid` ranges, and foreign tables don't have `ctid`. If the read fails with `[Aurora Analytics] system column is not supported`, run `SET pg_use_ctid_scan = false;` before the `COPY`.
- `PARTITION_BY` writes **one folder per value** of `linha`. Partition by a column with tens or hundreds of values, not thousands.
- Use a database user that can only `SELECT`, plus `READ_ONLY` on the `ATTACH`.

# Lessons learned (troubleshooting)

Errors I hit while testing this, in the order they showed up.

| Where | Error | Cause | Fix |
|---|---|---|---|
| Aurora | `ERROR: COPY to a file is not supported` | `COPY ... TO 's3://...'` is DuckDB syntax; Aurora only allows `COPY ... TO STDOUT` | Export with a standalone DuckDB (paths 1/2), or `aws_s3.query_export_to_s3` for CSV |
| Aurora (DBeaver) | visual plan shows only `Custom Scan` | the foreign-table part runs inside DuckDB, the plan viewer can't see into it | run `EXPLAIN ANALYZE` as SQL |
| DuckDB | `Unable to connect to URL https://<bucket>.s3.amazonaws.com/...: Bad Request (HTTP code 400)` | the session used stale or wrong credentials (expired session token, another account's profile, or a `REGION` that doesn't match the bucket) | log in again and recreate the secret with the bucket's region |
| DuckDB | `Failed to create directory "s3://...": No such file or directory` | `httpfs` isn't loaded in this session, so `s3://` is treated as a local path (`PARTITION_BY` creates folders first) | `LOAD httpfs; LOAD aws;` in **every** new session |
| DuckDB | `Secret Validation Failure: during create using the following: Credential Chain: 'config'` | the profile was created by `aws login` (`login_session = ...` in `~/.aws/config`), which DuckDB's AWS SDK doesn't understand | let the CLI hand the credentials to DuckDB (below) |

## DuckDB + `aws login`

The AWS CLI resolves `login_session` profiles; DuckDB doesn't (tested on DuckDB 1.4.4). The CLI can export its credentials, so use it as a bridge.

Option 1: a `credential_process` profile in `~/.aws/config` (refreshed on demand):

```ini
[profile duckdb]
credential_process = aws configure export-credentials --profile default --format process
region = us-east-1
```

```sql
CREATE OR REPLACE SECRET s3_creds (
    TYPE s3,
    PROVIDER credential_chain,
    CHAIN 'process',
    PROFILE 'duckdb',
    REGION 'us-east-1'
);
```

Option 2: environment variables (simple, but the credentials expire in minutes, so re-run it when you get errors again):

```bash
eval "$(aws configure export-credentials --format env)"
duckdb
```

```sql
CREATE OR REPLACE SECRET s3_creds (
    TYPE s3, PROVIDER credential_chain, CHAIN 'env', REGION 'us-east-1'
);
```

## Debugging S3 errors from DuckDB

"Bad Request (HTTP code 400)" hides the real S3 error code. Turn on HTTP logging to see it:

```sql
CALL enable_logging('HTTP');
-- run the failing COPY / read_parquet again
SELECT * FROM duckdb_logs WHERE type = 'HTTP' ORDER BY timestamp DESC LIMIT 5;
```

Look for `ExpiredToken`, `InvalidToken` or `AuthorizationHeaderMalformed` (region mismatch).

Other small lessons:
- Check which identity you're actually using (`aws sts get-caller-identity`) and that it's the account that owns the bucket.
- With `PARTITION_BY` the target is a **folder**: name it `products/`, not `products.parquet`. In Aurora, point the foreign table at the prefix (`s3://.../products/`).
- A credential_chain secret copies the credentials when it is created. If you logged in again after that, run `CREATE OR REPLACE SECRET` again.

# When this is the wrong tool

- **Many concurrent users running ad-hoc SQL**: DuckDB is one process; put Athena, Redshift Serverless or a MotherDuck-style service in front of the same S3 data.
- **Sub-second freshness**: watermark batches give minutes of latency. For real time you need CDC (logical replication, DMS, Debezium) into a streaming pipeline, or Aurora's zero-ETL integration with Redshift.
- **Data that fits in Aurora with an index**: if the report is `WHERE customer_id = ?` over a few thousand rows, keep it in Postgres.
- **Many writers to the same table**: plain Parquet has no concurrency control. Use Iceberg (commits are atomic, conflicting writers retry).

# Summary

| Step | Tool | SQL |
|---|---|---|
| Query Parquet/Iceberg from Aurora | `aurora_analytics` | `CREATE FOREIGN TABLE t () SERVER aurora_analytics_server OPTIONS (location '...', format 'parquet')` |
| Connect to Aurora | DuckDB `postgres` | `ATTACH '' AS pg (TYPE postgres, SECRET aurora, READ_ONLY)` |
| Credentials for S3 | DuckDB `aws` | `CREATE SECRET (TYPE s3, PROVIDER credential_chain)` |
| Export to Parquet | DuckDB `httpfs` | `COPY (...) TO 's3://...' (FORMAT parquet, PARTITION_BY (dt))` |
| Read Parquet | DuckDB `httpfs` | `read_parquet('s3://.../*/*.parquet', hive_partitioning = true)` |
| Attach Iceberg | DuckDB `iceberg` | `ATTACH '...' AS lake (TYPE iceberg, ENDPOINT_TYPE glue \| s3_tables)` |
| Write Iceberg | DuckDB `iceberg` | `INSERT INTO lake.schema.table SELECT ...` |
| Serve results | DuckDB `postgres` | `INSERT INTO pg_rw.analytics.table SELECT ...` |

Aurora stays fast for the application, S3 holds the history cheaply in an open format, and DuckDB does the columnar work on both sides: embedded in Aurora to read the lake, standalone to fill it.
