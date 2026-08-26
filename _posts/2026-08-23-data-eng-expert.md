---
layout: post
title: "Data Engineering: Data Expert Notes"
author: Carlos Pena
date: 2026-08-23
---

My notes from the Data Expert course.
Since I am working from a summary rather than the source, some details may be second-hand or incomplete.

---

# Chapter 1

Dimensions are the attributes of an entity.

- They can be fixed or slowly-changing
- Some dimensions are plain attributes (a listing's city), others are identifiers (the listing id)

## Know your consumer

The right model depends entirely on who reads the table.

| Consumer | What they need |
|---|---|
| Data analysts / scientists | Easy to query, few complex types |
| Other data engineers | Compact; complex types are fine |
| ML models | Depends on the model's input and training format |
| Customers | As easy as possible to interpret |

---

## OLTP, OLAP and master data

These three are not the same kind of thing, which is the part that confuses people.
OLTP and OLAP are **workload types** - they describe how a database is used, so they map to
a technology choice. Master data is a **data category** - it describes what the rows mean,
and it lives inside both workloads at the same time.

**OLTP** (Online Transaction Processing - Postgres, Oracle, MySQL)
- Low-latency, low-volume queries
- Many small writes, one row at a time
- Normalized, so a single entity is spread across many tables

**OLAP** (Online Analytical Processing - BigQuery, Snowflake, Redshift)
- Large volumes, heavy GROUP BY, minimizes joins
- Columnar storage, so a query only reads the columns it needs
- Few huge reads instead of many small writes

**Master data** - the nouns of the business
- The core entities that exist independently: customer, product, listing, employee, supplier
- Contrast with transactional data (the events between them: an order, a payment, a booking)
- Deduplicated: one golden record per real-world entity, so the same customer registered in
  the CRM, the ERP and the support tool collapses into a single row with a stable id
- Optimizes for completeness of the entity definition rather than for speed

Test for identifying it: *if I delete all transactions, does this thing still need to exist?*
A customer still exists, so it is master data. An invoice does not, so it is transactional.

Obs. There is no "master data database". There are MDM tools (Informatica MDM, SAP MDG,
Stibo STEP), but they are applications on top of an ordinary relational database, not a third
engine type. Most companies do MDM by convention: declare one system of record per entity and
have everyone else copy from it.

In a star schema: **dimensions are master data, facts are transactional data.**

```text
Production Data  ->  Master Data  ->  OLAP Cubes  ->  Metrics
```

---

## Compactness vs usability

| Level | When | Consumer |
|---|---|---|
| Compact | Online systems, low latency, high volume | Technical systems |
| Middle | The majority case | Other data engineers |
| Usable | Analytics and BI | Analysts |

## Complex types

| Type | Keys | Values |
|---|---|---|
| Struct | Rigidly defined, good for compression | Can be of any type |
| Map | Loosely defined, added at runtime | Must all be the same type |
| Array | Ordinal (position matters) | Must all be the same type |

---

## Temporal data modeling

Obs. **Level == grain.** The grain answers one question: *what does one row represent?*

Adding a temporal aspect to a dimension causes a **cardinality explosion**. Airbnb has about
6 million listings; storing nightly price and availability for the next year gives
`365 x 6,000,000 = ~2.19 billion` nights. The dimension becomes bigger than most fact tables.

### Option A: listing-level with an array

One row per listing. All the nights are packed into an array column inside that single row.

```text
listing_id | nights
-----------+--------------------------------------------------
   1001    | [ {night: 2026-08-23, price: 450, avail: true },
           |   {night: 2026-08-24, price: 450, avail: true },
           |   {night: 2026-08-25, price: 600, avail: false} ]
-----------+--------------------------------------------------
   1002    | [ {night: 2026-08-23, price: 320, avail: true },
           |   {night: 2026-08-24, price: 380, avail: false},
           |   {night: 2026-08-25, price: 380, avail: true } ]
```

Average booked price per listing, by exploding the array:

```sql
-- BigQuery / Trino. Spark uses LATERAL VIEW explode(nights) AS n
SELECT
  l.listing_id,
  AVG(n.price) AS avg_booked_price,
  COUNT(*)     AS booked_nights
FROM listings AS l
CROSS JOIN UNNEST(l.nights) AS n
WHERE n.avail = FALSE
GROUP BY l.listing_id;
```

This works but throws away the advantage: it explodes to 2.19B rows and then shuffles them
back together. The better form runs a correlated subquery inside each row, with no GROUP BY
and no shuffle:

```sql
-- BigQuery / Trino: a correlated subquery over the array
SELECT
  listing_id,
  (SELECT AVG(n.price)
   FROM UNNEST(nights) AS n
   WHERE n.avail = FALSE) AS avg_booked_price
FROM listings;
```

Spark has no correlated subquery over arrays; use higher-order functions, which also run
per-row with no shuffle:

```sql
-- Spark
SELECT
  listing_id,
  aggregate(p, CAST(0 AS DOUBLE), (acc, x) -> acc + x) / nullif(size(p), 0) AS avg_booked_price
FROM (
  SELECT listing_id, transform(filter(nights, n -> NOT n.avail), n -> n.price) AS p
  FROM listings
);
```

Pros:
- Row count stays at the entity grain (6M instead of 2.19B): much cheaper shuffles, joins and GROUP BY
- One row = one entity, so no fan-out and no risk of double counting when joining
- Entity-level questions are cheap (count listings, filter by city), no DISTINCT needed
- One read returns a listing's whole calendar; the nights are physically together
- Good as an upstream table when the consumer is another data engineer

Cons:
- Any night-level filter or aggregation needs UNNEST first
- No predicate pushdown on values inside the array; filtering one night still reads the whole array column
- Cannot partition by night
- Many BI tools do not handle ARRAY<STRUCT>
- Updating a single night rewrites that listing's entire array

### Option B: listing-night level (the exploded one)

One row per listing per night.

```text
listing_id |   night     | price | avail
-----------+-------------+-------+-------------
   1001    | 2026-08-23  |  450  | true
   1001    | 2026-08-24  |  450  | true
   1001    | 2026-08-25  |  600  | false
   1002    | 2026-08-23  |  320  | true
   1002    | 2026-08-24  |  380  | false
   1002    | 2026-08-25  |  380  | true
```

```sql
SELECT
  listing_id,
  AVG(price) AS avg_booked_price,
  COUNT(*)   AS booked_nights
FROM listing_nights
WHERE avail = FALSE
GROUP BY listing_id;
```

Pros:
- Flat, so every consumer and every BI tool understands it
- Filters on night use predicate pushdown and partition pruning directly
- Can be partitioned by night, so a one-day query reads one partition
- Trivial SQL, no UNNEST
- Easy incremental writes: a new day is just new rows

Cons:
- 2.19B rows means expensive shuffles, joins and GROUP BY
- Entity-level counts need DISTINCT, which is easy to get wrong
- Only stays compact if sorted correctly; unsorted it is much bigger on disk
- Listing attributes repeat 365x if denormalized, so it needs a join back to the dimension

### Size on disk

Obs. In a columnar format (Parquet/ORC) **and** with the data sorted by listing_id, the two
options are roughly the same size. Parquet shreds a struct into separate column chunks, so an
array of structs is physically stored much like the flat version. Sorted, the repeated
listing_id run-length encodes down to almost nothing.

Obs. This is Parquet-specific. In CSV/JSON option B is far bigger, because listing_id is
physically written 365 times per listing with no cross-row compression.

Obs. Same size on disk does **not** mean same cost to query. Option B is still 365x more rows
for the engine to shuffle and join.

### Sorting and RLE

Obs. GROUP BY and JOIN shuffle the data and mix up row order, which makes run-length encoding
less effective. The fix is not to re-sort at every step - only the row order at the moment of
write affects the file, so sort **once**, immediately before writing.

| Spark SQL | Shuffle? | What it does |
|---|---|---|
| `ORDER BY` | Yes, range | Global total order - expensive, rarely needed |
| `SORT BY` | No | Sorts within each partition - this is the one to use |
| `DISTRIBUTE BY` | Yes, hash | Co-locates rows without sorting |
| `CLUSTER BY` | Yes, hash | `DISTRIBUTE BY x SORT BY x` |

Global order is unnecessary because RLE operates inside a Parquet row group, which lives
inside one file written by one partition.

```sql
INSERT OVERWRITE TABLE db.listing_nights
SELECT /*+ REBALANCE(listing_id) */ *
FROM enriched
SORT BY country, city, listing_id, night;
```

Rules of thumb:
- Never sort intermediate CTEs; place the single sort after the last shuffle
- Put the lowest-cardinality column first in the sort key, so runs are longest
- Distribute on a high-cardinality column to avoid skew, but sort low-cardinality first
- Keep files large (128 MB - 1 GB); tiny files mean short row groups and weak RLE

### Converting between the two

```sql
-- BigQuery / Trino
-- explode: A -> B
SELECT listing_id, n.night, n.price, n.avail
FROM listings
CROSS JOIN UNNEST(nights) AS n;

-- collapse: B -> A
SELECT listing_id,
       ARRAY_AGG(STRUCT(night, price, avail) ORDER BY night) AS nights
FROM listing_nights
GROUP BY listing_id;
```

```sql
-- Spark: explode is a LATERAL VIEW, and collect_list takes no ORDER BY,
-- so sort the array afterwards
-- explode: A -> B
SELECT listing_id, n.night, n.price, n.avail
FROM listings
LATERAL VIEW explode(nights) t AS n;

-- collapse: B -> A
SELECT listing_id,
       array_sort(collect_list(struct(night, price, avail))) AS nights
FROM listing_nights
GROUP BY listing_id;
```

Common practice: keep A as the internal upstream table and explode into B for the analytics layer.

---

## Cumulative Table Design

Goal: answer "how many days was each host active in the last 30 days?" without rescanning
30 days of raw events on every run.

```text
naive:       [30 days of events]  -> aggregate      cost grows with the window
cumulative:  [yesterday] + [today] -> merge         cost is constant
```

```sql
-- naive: scans 30 days of raw events EVERY DAY
SELECT host_id, COUNT(DISTINCT DATE(event_time)) AS days_active_30d
FROM bookings
WHERE DATE(event_time) BETWEEN date_sub(DATE '2026-08-23', 29) AND DATE '2026-08-23'
GROUP BY host_id;
```

Target table:

```sql
CREATE TABLE hosts_cumulated (
  host_id       STRING,
  dates_active  ARRAY<DATE>    -- every date the host was active, newest first
)
PARTITIONED BY (snapshot_date DATE);   -- partition key, NOT in the column list
```

### Step 1: define the CTE for `yesterday`

Read the previous snapshot only, never the raw events. This is a single partition, and that
is the whole point of the pattern.

```sql
WITH yesterday AS (
  SELECT host_id, dates_active
  FROM hosts_cumulated
  WHERE snapshot_date = DATE '2026-08-22'
)
```

### Step 2: define the CTE for `today`

Exactly one day of source events, reduced to one row per entity.

```sql
, today AS (
  SELECT host_id, DATE(event_time) AS date_active
  FROM bookings
  WHERE DATE(event_time) = DATE '2026-08-23'
  GROUP BY host_id, DATE(event_time)   -- dedupe, otherwise the join fans out
)
```

The GROUP BY matters. Without it, a host with 50 bookings today produces 50 rows in `today`,
so the full outer join emits 50 output rows for that host - each one carrying its own copy of
yesterday's array. The snapshot ends up with 50 duplicate `host_id` rows, not one row with a
50-element array.

### Step 3: create the full outer join

```sql
FROM today AS t
FULL OUTER JOIN yesterday AS y ON t.host_id = y.host_id
```

Three cases exist every day, and only FULL OUTER handles all three:

```text
y NULL,    t present  -> brand new host
y present, t NULL     -> existing host, idle today
y present, t present  -> existing host, active today
```

What the other join types lose:

| Join | What breaks |
|---|---|
| `INNER` | Keeps only hosts in both sides - the table is destroyed |
| `LEFT` (today) | Loses every host who existed in history but was idle today |
| `RIGHT` (yesterday) | Loses brand new hosts |

### Step 4: coalesce the values

Either side of the join can be NULL, so coalesce - starting with the join key itself. This is
the step people get wrong: writing plain `t.host_id` gives every idle host a NULL id and
destroys the table on the first run.

```sql
SELECT
  COALESCE(t.host_id, y.host_id) AS host_id,
  COALESCE(t.country, y.country) AS country,   -- illustrative: add country to both CTEs first
```

### Step 5: aggregate the values

Prepend today so that index 0 is always the most recent date, which makes "was active
yesterday?" an O(1) lookup instead of a scan.

```sql
  CASE
    WHEN y.dates_active IS NULL THEN array(t.date_active)              -- new host
    WHEN t.date_active IS NULL THEN y.dates_active                     -- idle today
    ELSE concat(array(t.date_active), y.dates_active)                  -- active today
  END AS dates_active
```

### The full query

```sql
INSERT OVERWRITE TABLE hosts_cumulated
PARTITION (snapshot_date = '2026-08-23')

WITH yesterday AS (
  SELECT host_id, dates_active
  FROM hosts_cumulated
  WHERE snapshot_date = DATE '2026-08-22'
),
today AS (
  SELECT host_id, DATE(event_time) AS date_active
  FROM bookings
  WHERE DATE(event_time) = DATE '2026-08-23'
  GROUP BY host_id, DATE(event_time)
)
SELECT
  COALESCE(t.host_id, y.host_id) AS host_id,
  CASE
    WHEN y.dates_active IS NULL THEN array(t.date_active)
    WHEN t.date_active IS NULL THEN y.dates_active
    ELSE concat(array(t.date_active), y.dates_active)
  END AS dates_active
FROM today AS t
FULL OUTER JOIN yesterday AS y ON t.host_id = y.host_id;
```

Obs. Postgres dialect: `ARRAY[t.date_active]` for the literal, `||` for concat, and
`= ANY(arr)` for membership.

Obs. This statement reads `hosts_cumulated` in the CTE while overwriting it, which Spark
rejects on file-based tables with `Cannot overwrite a path that is also being read from`.
Either write to a staging table and swap, or use dynamic partition overwrite:

```sql
SET spark.sql.sources.partitionOverwriteMode = dynamic;
```

### Step 0: the bootstrap

Day one has no yesterday. Run this once, then the loop above takes over.

```sql
INSERT OVERWRITE TABLE hosts_cumulated
PARTITION (snapshot_date = '2026-08-01')
SELECT host_id, array(DATE(event_time)) AS dates_active
FROM bookings
WHERE DATE(event_time) = DATE '2026-08-01'
GROUP BY host_id, DATE(event_time);
```

### Step 6: prune the array

Without pruning the array grows forever. Cap it at the longest window needed - the cap
permanently limits which questions the table can answer, so choose it deliberately.

```sql
  filter(
    CASE
      WHEN y.dates_active IS NULL THEN array(t.date_active)
      WHEN t.date_active IS NULL THEN y.dates_active
      ELSE concat(array(t.date_active), y.dates_active)
    END,
    d -> d > date_sub(DATE '2026-08-23', 30)
  ) AS dates_active
```

### Reading the result

Every one of these is a single-row operation: no joins, no shuffle.

Obs. `days_active_all_time` is only true if you skipped Step 6. Once the array is pruned to 30
days, `size(dates_active)` is capped at 30 and means the same thing as `days_active_30d`.

```sql
SELECT
  host_id,
  size(dates_active)                                               AS days_active_all_time,
  size(filter(dates_active, d -> d > date_sub(snapshot_date, 7)))  AS days_active_7d,
  size(filter(dates_active, d -> d > date_sub(snapshot_date, 30))) AS days_active_30d,
  array_contains(dates_active, snapshot_date)                      AS active_today,
  dates_active[0]                                                  AS last_active_date,
  datediff(snapshot_date, dates_active[0])                         AS days_since_last_active
FROM hosts_cumulated
WHERE snapshot_date = DATE '2026-08-23';
```

### datelist_int: 30 days packed into 8 bytes

Bit 0 is today and bit 29 is 29 days ago. `bit_count` returns the active-day count in a single
CPU instruction, so MAU/WAU metrics become bitwise operations instead of joins.

```sql
WITH series AS (
  SELECT explode(sequence(date_sub(DATE '2026-08-23', 29), DATE '2026-08-23')) AS series_date
),
bits AS (
  SELECT
    h.host_id,
    CASE WHEN array_contains(h.dates_active, s.series_date)
         THEN CAST(POW(2, datediff(DATE '2026-08-23', s.series_date)) AS BIGINT)
         ELSE 0
    END AS bit_value
  FROM hosts_cumulated h
  CROSS JOIN series s
  WHERE h.snapshot_date = DATE '2026-08-23'
)
SELECT
  host_id,
  SUM(bit_value)                            AS datelist_int,
  bit_count(CAST(SUM(bit_value) AS BIGINT)) AS days_active_30d,
  CAST(SUM(bit_value) AS BIGINT) & 127      AS active_last_7d_mask  -- bits 0-6
FROM bits
GROUP BY host_id;
```

### The two drawbacks, made concrete

**Sequential backfill.** Day N depends on day N-1, so the pattern cannot be parallelized. Two
years of backfill is 730 sequential runs, and no amount of cluster capacity speeds it up. A bug
found in a cumulative table means re-running the entire chain.

Parameterize the date first - the query above hardcodes it, so replace both literals with
`${ds}` and pass it with `-d` (spark-sql has no `--date` flag):

```bash
# 2024-08-23 through 2026-08-23 inclusive = 731 days
for i in $(seq 0 730); do
  ds=$(date -d "2024-08-23 +$i days" +%F)
  spark-sql -d ds="$ds" -f cumulate.sql || break   # stop on failure, the chain is ordered
done
```

**PII.** Once a date lands in `dates_active` it is embedded in every later snapshot, so a
deletion request means rewriting every partition rather than deleting one row. Mitigations:
key the table on a pseudonymous id with the mapping held in a separate deletable table, or
keep retention short enough that the data ages out on its own.

---

# Chapter 2

## Idempotency

A pipeline should produce the same result regardless of the day, the time, or the number of tries.

Rules:
- Use `MERGE` or `INSERT OVERWRITE`
- Never use `INSERT INTO` without a truncate: a rerun appends instead of replacing
- A `start_date >` must have the corresponding `end_date <`. An open-ended window grows with
  wall-clock time, so the same run date gives a different answer tomorrow
- Use `depends_on_past` for cumulative pipelines (Dagster: a self-dependency via
  `TimeWindowPartitionMapping(start_offset=-1, end_offset=-1)`)
- Do not join to the `latest` partition of a dimension. Backfilling 2024 would pick up today's
  values, so the run stops being a function of `ds`. SCD Type 2 with a validity window is the fix
  for this, not an exception to it - reading your own *previous* partition is a different thing,
  and that one is `depends_on_past`
- Use a **full** set of partition sensors: one per upstream table, blocking until the data is
  ready. The usual failure is not zero sensors, it is a sensor on the one obvious upstream and
  nothing on the other three

Obs. A sensor and a check answer different questions, and you need both:

| Mechanism | Question |
|---|---|
| Partition sensor | Has the upstream partition arrived? |
| Asset check | Is the partition that arrived actually complete? |

Existence is not completeness: a partition directory appears as soon as the first file lands.
`blocking=True` is what makes a check a gate rather than a dashboard.

```python
@dg.asset_check(asset="bookings", blocking=True)
def bookings_row_count(context):
    n = query(f"SELECT count(*) FROM bookings WHERE ds = '{context.partition_key}'")
    return dg.AssetCheckResult(passed=n > 100_000, metadata={"rows": n})
```

---

## Slowly Changing Dimensions (SCD)

Dimensions whose value changes over time: age (every year), country (on a move).

Options:
- SCD proper (Types 1, 2, 3)
- Daily/monthly/latest snapshot - simpler, and often enough

**Type 1** - overwrite with the latest value
- One row per dimension, no history
- Makes the pipeline non-idempotent: a backfill sees today's value, not the value as of `ds`
- Acceptable only when history has no analytical meaning (a corrected spelling, a fixed
  data-entry error). Never for an attribute you might filter or group by *as of* a past date

**Type 2** - one row per value, bounded by `start_date` and `end_date`. The Airbnb favorite
- Idempotent when rebuilt from a source that retains full history
- The incremental form (close the open row, insert a new one) is **not** idempotent: a rerun
  either double-closes a record or leaves two open rows for the same key
- More than one row per dimension, so every join needs the validity window or it fans out
- Decide what an open record carries as `end_date`: `NULL` breaks the `<` comparison,
  `9999-12-31` does not

```sql
ON  d.host_id = f.host_id
AND f.event_date >= d.start_date
AND f.event_date <  d.end_date
```

**Type 3** - original value and current value, side by side in two columns
- One row per dimension
- Loses everything between the first value and the current one

Obs. Incremental Type 2 is sequential and stateful, so it fights the rerun-any-task-any-time
model - the same problem as the cumulative tables in Chapter 1. Dagster's self-dependency makes
the ordering explicit, but it does not make it parallel.

---

# Chapter 3 - Graph and Additive Dimensions

## Additive dimensions

Addition only works when the pieces do not overlap. The values of a dimension have to form a
partition of the entities: every entity lands in exactly one bucket, never zero, never two.
When that holds, the parts sum to the whole. When it does not, summing overcounts.

So additivity is not a property of the numbers. It is a property of the relationship between
the entity and the dimension.

| Entity to dimension | Additive? |
|---|---|
| One driver, one age | Yes |
| One driver, one country of registration | Yes |
| One driver, many car models owned | No |
| One driver, many languages spoken | No |

The question to ask every time: *can a single entity hold two values of this dimension at once?*
If yes, stop adding.

```text
Honda drivers != Civic drivers + Corolla drivers + CR-V drivers + ...
```

Someone who owns both a Civic and a CR-V is counted twice. Nothing in the per-model numbers
says so, which is what makes this bug quiet.

### The time window is part of the claim

The same dimension flips between additive and non-additive depending on the window.

| Window for "device type" | Can one user have two values? | Additive? |
|---|---|---|
| One page view | No, one request has one device | Yes |
| One day | Usually not | Mostly |
| One month | Yes: phone on the train, laptop at work | No |
| Lifetime | Almost certainly | No |

> A dimension is additive over a time window if and only if, within that window, each entity
> can hold exactly one value of it.

"Device type is additive" is an incomplete sentence; "device type is additive per page view"
is a true one. So put the window in the name: `daily_active_by_device` is honest,
`active_by_device` invites the bug.

### COUNT DISTINCT has the same disease

The sum of daily distinct users is not monthly distinct users - a user active on Monday and
Tuesday is one person in the month and two rows in the daily table. This is why `SUM` is safe
in pre-aggregated tables and `COUNT(DISTINCT ...)` is not: sums of disjoint things compose,
distinct counts do not.

### Both grains, same question

"How many Honda drivers?" asked against the two grains from Chapter 1.

```sql
-- compact: one row per driver, models in an array
-- additive, because each driver appears exactly once
SELECT count(*) AS honda_drivers
FROM drivers
WHERE array_contains(models_owned, 'Honda');
```

```sql
-- exploded: one row per driver per model
-- non-additive, so the per-model counts cannot be summed
SELECT count(DISTINCT driver_id) AS honda_drivers
FROM driver_models
WHERE brand = 'Honda';
```

Exploding is what created the duplication, and `COUNT DISTINCT` is what undoes it.

Rules of thumb:
- Pre-aggregate only on additive dimensions. A summary table keyed by a non-additive dimension
  cannot be rolled up further, and someone will roll it up anyway
- To roll up over a non-additive dimension, store the entity-level set (array, bitmap,
  HyperLogLog sketch). The set is what makes deduplication possible later
- `datelist_int` in Chapter 1 is exactly that trick: keep the set, so the count stays correct

---

## Enums

Good for low-to-medium cardinality, roughly up to ~15 values. Country is usually too high.

- Better data quality: the pipeline fails on an unexpected value instead of silently
  absorbing it
- Static field, so the schema itself documents the full list of possible values
- An exhaustive list chunks a big-data problem into manageable pieces: one branch per value,
  each handled and tested on its own

Reference: [little-book-of-pipelines](https://github.com/EcZachly/little-book-of-pipelines)

### Modeling diverse sources into a shared schema

The problem: many upstream sources, each with its own fields, feeding one table.

| Approach | Pros | Cons |
|---|---|---|
| Rigid schema, one column per field | Compression, readability, queryability | ALTER TABLE for every new source, and a lot of NULLs |
| Flexible schema, `other_properties MAP<STRING, STRING>` | No DDL per source, no NULL columns | Worse compression (especially JSON), worse readability, worse queryability |

Common practice: keep the map for the long tail, and promote a field into a real column once
enough sources send it.

---

## Graph modeling

Relationship-focused rather than entity-focused. The schema stops describing *what a thing is*
and starts describing *how things connect*, which is why the same two tables hold every entity
type.

Vertex:

```text
identifier:  STRING
type:        STRING                  -- player, team, game
properties:  MAP<STRING, STRING>
```

Edge:

```text
subject_identifier: STRING
subject_type:       VERTEX_TYPE
object_identifier:  STRING
object_type:        VERTEX_TYPE
edge_type:          EDGE_TYPE             -- plays_on, plays_against
properties:         MAP<STRING, STRING>   -- how many years, points scored
```

```text
                    plays_against
   Michael Jordan ------------------- John Stockton
         |                                  |
         | plays_on                         | plays_on
         |                                  |
   Chicago Bulls                        Utah Jazz
```

| subject | edge_type | object |
|---|---|---|
| Michael Jordan | plays_on | Chicago Bulls |
| Michael Jordan | plays_against | John Stockton |
| John Stockton | plays_on | Utah Jazz |

Obs. The edges mix vertex types on purpose: `plays_on` is player-to-team, `plays_against` is
player-to-player. That is the tradeoff - the model answers "who is connected to whom" across
any pair of types, and gives up the column-level typing, compression and pushdown a star
schema would have.
