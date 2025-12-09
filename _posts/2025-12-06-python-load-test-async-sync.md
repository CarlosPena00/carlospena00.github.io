---
layout: post
title: "Python: Load Test with FastAPI - Sync vs Async"
author: Carlos Pena
date: 2025-12-06
---

# Load Test — Summary and Findings

This document summarizes controlled load experiments run against FastAPI endpoints to evaluate how implementation style (async vs sync vs mixed) and Uvicorn worker count affect latency, throughput, and error behavior. The goal is to provide clear conclusions and actionable recommendations for designing and operating web endpoints under load.

---

## Quick-run example

- Example load command used interactively in tests:


> TARGET_VUS=10000 k6 run load_test.js

JavaScript test script used (unchanged):

```js
import http from 'k6/http';

const TARGET = __ENV.TARGET_VUS ? parseInt(__ENV.TARGET_VUS, 10) : 50;

export let options = {
  stages: [
    { duration: '1s', target: TARGET },
    { duration: '30s', target: TARGET },
  ],
};

export default function () {
  http.get('http://localhost:8000/***');
}
```

---

## Endpoints tested (representative snippets)

Async IO-bound endpoint (non-blocking sleep):

```py
@app.get("/async_endpoint_async_processing")
async def async_endpoint_async_processing_api(ms: int = 1000):
    await asyncio.sleep(ms / 1000)
    return {"wait_ms": ms}
```

Sync blocking endpoint (blocking sleep):

```py
@app.get("/sync_endpoint_sync_processing")
def sync_endpoint_sync_processing_api(ms: int = 1000):
    time.sleep(ms / 1000)
    return {"wait_ms": ms}
```

Mixed examples used to test pathological behavior:

```py
@app.get("/sync_endpoint_mix_processing")
def sync_endpoint_mix_processing_api(ms: int = 500):
    anyio.run(asyncio.sleep, ms / 1000)
    time.sleep(ms / 1000)
    return {"wait_ms": ms}
```

```py
@app.get("/async_endpoint_mix_processing")
async def async_endpoint_mix_processing_api(ms: int = 500):
    await asyncio.sleep(ms / 1000)
    time.sleep(ms / 1000)
    return {"wait_ms": ms}
```

---

## Methodology

- Single-variable experiments: change only the Uvicorn `--workers` setting between runs while keeping the load profile and endpoint parameters constant.
- Key metrics collected:
  - Throughput (http_reqs and req/s)
  - Latency distribution (avg, p50/med, p90, p95, max)
  - Error rate (http_req_failed)
- Success criteria: zero error rate, and p95 latency approximately equal to the expected non-blocking wait time plus small overhead for async endpoints.

Notes on interpretation:
- For an endpoint that performs only `await asyncio.sleep(1s)`, a well-provisioned async system should exhibit p95 ≈ 1s (plus small overhead). Substantially higher p95 indicates queuing, worker saturation, or blocking operations inside the event loop.
- For blocking endpoints (time.sleep), throughput will scale roughly with the number of worker processes; expect higher latency and lower throughput per worker vs async.

---

## Results (selected, condensed outputs)

### Async endpoint: `/async_endpoint_async_processing` (ms=1000)

- workers=1

```js
    HTTP
    http_req_duration....................: avg=4.67s min=2.48s med=4.73s max=6.49s p(90)=5.28s p(95)=5.83s
      { expected_response:true }.........: avg=4.67s min=2.48s med=4.73s max=6.49s p(90)=5.28s p(95)=5.83s
    http_req_failed......................: 0.00%  0 out of 67607
    http_reqs............................: 67607  2044.475362/s
```

- workers=6

```js
    HTTP
    http_req_duration....................: avg=1.25s min=1s med=1.21s max=1.93s p(90)=1.49s p(95)=1.55s
      { expected_response:true }.........: avg=1.25s min=1s med=1.21s max=1.93s p(90)=1.49s p(95)=1.55s
    http_req_failed......................: 0.00%  0 out of 247326
    http_reqs............................: 247326 7637.521367/s
```

Interpretation:
- With 1 worker the event loop is a bottleneck, producing long tail latencies (p95 ~ 5.8s). With 6 workers, per-worker event loop parallelism reduces queuing and p95 approaches the expected ~1s wait time.
- Conclusion: For IO-bound async handlers, increasing worker count improves throughput and tail latency until other resources become limiting.

---

### Sync endpoint

- workers=16

#### Sync Processing

```js
    http_req_duration....................: avg=13.12s min=1s med=14.05s max=21.07s p(90)=18.06s p(95)=18.98s
      { expected_response:true }.........: avg=13.12s min=1s med=14.05s max=21.07s p(90)=18.06s p(95)=18.98s
    http_req_failed......................: 0.00%  0 out of 29200
    http_reqs............................: 29200  566.189121/s
```

#### Async Processing

```js
    http_req_duration....................: avg=13.09s min=1.03s med=14.15s max=19.24s p(90)=18.13s p(95)=19.02s
      { expected_response:true }.........: avg=13.09s min=1.03s med=14.15s max=19.24s p(90)=18.13s p(95)=19.02s
    http_req_failed......................: 0.00%  0 out of 29200
    http_reqs............................: 29200  588.125895/s
```

Interpretation:
- Blocking `time.sleep` ties up each worker process for the duration of the request, so throughput remains limited even with many workers. Latency percentiles reflect queuing and constrained parallelism.

Comparison with wrapping async in sync using `anyio.run` shows similar behavior, wrapping non-blocking calls inside synchronous handlers still incurs worker blocking.

---

### Mixed processing (pathological cases)

- Sync wrapper with `anyio.run` + blocking sleep (`sync_endpoint_mix_processing`) — workers=16

```js
    HTTP
    http_req_duration....................: avg=15.65s min=5s med=15.54s max=28.23s p(90)=19.71s p(95)=22s
      { expected_response:true }.........: avg=15.65s min=5s med=15.54s max=28.23s p(90)=19.71s p(95)=22s
    http_req_failed......................: 0.00%  0 out of 24337
    http_reqs............................: 24337  485.549164/s
```

- Async handler that calls blocking `time.sleep` (`async_endpoint_mix_processing`) — workers unspecified

```js
    HTTP
    http_req_duration....................: avg=54.06s min=1s med=59.98s max=1m0s   p(90)=1m0s  p(95)=1m0s
      { expected_response:true }.........: avg=30.46s min=1s med=30.47s max=59.99s p(90)=54.3s p(95)=57.02s
    http_req_failed......................: 80.95% 8089 out of 9992 // fail!
    http_reqs............................: 9992   163.756346/s
```

Interpretation:
- Introducing synchronous blocking operations into an async handler blocks the event loop, quickly causing severe degradation: very high latencies and large numbers of failed requests.
- Mixed workloads that include blocking code inside async paths are dangerous and unreliable under moderate to high load.

---

## Postgres SELECT: Async vs. Sync

- Workers: 4
- Target VUs: 2000
- Using external DB (in the same network)

```py
@app.get("/sync_select")
def sync_select_api(user_id: int = 1):
    assert sync_pool is not None, "Sync pool not initialized"
    with sync_pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(QUERY, {"user_id": user_id})
            rows = cur.fetchall()
    return {"rows": rows}

@app.get("/async_select")
async def async_select_api(user_id: int = 1):
    assert async_pool is not None, "Async pool not initialized"
    async with async_pool.connection() as aconn:
        async with aconn.cursor() as cur:
            await cur.execute(QUERY, {"user_id": user_id})
            rows = await cur.fetchall()
    return {"rows": rows}
```


```js
// Sync results
http_req_duration....................: avg=1.7s min=24.69ms med=1.75s max=2.2s p(90)=1.99s p(95)=2.03s
{ expected_response:true }...........: avg=1.7s min=24.69ms med=1.75s max=2.2s p(90)=1.99s p(95)=2.03s
http_req_failed......................: 0.00%  0 out of 36601
http_reqs............................: 36601  1123.598929/s

// Async results
http_req_duration....................: avg=967.04ms min=8.03ms med=978.02ms max=1.26s p(90)=1.08s p(95)=1.12s
{ expected_response:true }...........: avg=967.04ms min=8.03ms med=978.02ms max=1.26s p(90)=1.08s p(95)=1.12s
http_req_failed......................: 0.00%  0 out of 63899
http_reqs............................: 63899  2007.858967/s
```

### Interpretation

- Async DB access roughly halves p95 compared to sync and sustains ~1.8× throughput under the same load (VUs=2000, workers=4).
- Both report 0% errors; async delivers lower tail latency and better concurrency utilization.
- Use async drivers/pools for IO-bound DB queries. Reserve sync for simple or low-concurrency paths, or isolate via separate workers.
- Note: When using async, reduce `AsyncConnectionPool` `max_size` to avoid "too many clients" errors (e.g., `FATAL: sorry, too many clients already`).

---

## High-level conclusions

1. Async IO-bound endpoints (pure `await` non-blocking operations) scale well with additional Uvicorn workers and produce low tail latency when workers > 1.
2. Blocking endpoints (synchronous `time.sleep` or CPU-bound work) consume a worker for the entire request lifetime; throughput scales with worker count but remains much lower than async IO for equivalent simulated waits.
3. Wrapping async operations inside synchronous handlers (or vice versa) does not yield the benefits of async: it still blocks workers.
4. Mixing blocking calls into async handlers can saturate the event loop, producing very high latencies and request failures.

---

## Recommendations (practical)

- Implement IO-bound handlers as `async def` and use non-blocking libraries for I/O (databases, HTTP clients, etc.). Benchmark worker counts to find the inflection point where additional workers provide diminishing returns.
- Run CPU-bound work outside request handlers: use task queues or `run_in_executor` to avoid blocking the event loop or occupying a worker for long durations.
- Avoid mixing blocking calls into async handlers. If legacy blocking code must be used, isolate it in separate sync endpoints or offload to background workers.
- Monitor tail latency (p95/p99) and resource utilization (CPU, memory, FD count) on the server during tests to identify bottlenecks.


---

# Full Test

Simulate a production-like scenario consisting of an endpoint that:
1. Performs two database queries
2. Applies some post-processing

## Setup

- Notebook: 16GB, AMD Ryzen™ 5 5625U
  - K6 Load test
- Desktop: 32GB, AMD Ryzen 5 5600X
  - Postgres
  - FastAPI

---


# Report: Comparison of FastAPI Sync vs Async Endpoints

This report summarizes load test results comparing FastAPI endpoints implemented using synchronous (sync) handlers and asynchronous (async) handlers. The workload combines database I/O and a CPU-bound Fibonacci calculation. Tests vary the Fibonacci depth (FIB) to simulate increasing CPU intensity and measure its impact on latency and throughput.

## Summary of Findings

- Under moderate CPU load (FIB 15–20), async endpoints consistently show slightly lower latency and higher throughput than sync endpoints with the same worker configuration.
- As CPU intensity increases (FIB 25), both async and sync latencies rise and throughput drops. Async retains a modest advantage but the gap narrows.
- At higher CPU intensity (FIB 30), both implementations experience substantial latency increases and reduced throughput. Results converge, indicating CPU saturation dominates performance regardless of async vs sync handler.
- With more workers (e.g., 4 workers), both sync and async scale reasonably well for low to moderate FIB values. The async implementation tends to maintain better tail latency (p90/p95) up to the point where CPU becomes the bottleneck.
- With only 1 worker, both sync and async show significant degradation as FIB increases. Async still performs slightly better at lower FIB but both converge when CPU dominates.
- Error rates remain 0% across scenarios, indicating the system stayed stable under tested loads, and performance changes are primarily due to resource contention (CPU) and queuing.

## Interpretation

- Async advantages are most visible for I/O-bound phases and light-to-moderate CPU work. Async allows non-blocking orchestration of concurrent DB calls (e.g., using `asyncio.gather`), improving effective concurrency and reducing queuing.
- When CPU-bound work dominates, the event loop (async) and worker processes (sync) both contend for CPU, eroding the benefits of async. In these cases, offloading CPU tasks is more impactful than choosing sync vs async for the handler itself.
- The small but consistent latency improvements with async at lower FIB values align with expectations: async helps overlap I/O while keeping handlers responsive.

## Conclusion

- For mixed workloads with meaningful I/O and moderate CPU, prefer async endpoints to leverage non-blocking concurrency and achieve better latency and throughput.
- For heavy CPU-bound workloads, handler style (sync vs async) matters less than offloading CPU work. Use process pools (`ProcessPoolExecutor`), dedicated workers (Celery/RQ), or services to process CPU-heavy tasks outside the request path.
- Ensure database access uses efficient clients (async drivers for async handlers, connection pooling for both). Parallelize independent queries (async with `asyncio.gather`; sync with threads if needed) while keeping pool sizes appropriate.
- Scale workers judiciously. More workers help up to hardware limits, but do not fix CPU-bound saturation; offloading and batching are more effective.

## Recommendations

- Keep async endpoints for I/O-heavy paths and orchestrate concurrent DB calls using async patterns.
- Avoid placing long CPU-bound operations directly in async handlers; use `run_in_executor` or a process pool to keep the event loop responsive.
- For sync endpoints that must parallelize I/O, use a thread pool and ensure the DB pool can provide enough connections.
- Monitor tail latency (p90/p95), throughput, CPU utilization, and connection/FD usage to tune worker counts and pool sizes.

---

# Comparison Results

- Workers = 4, VU = 32

```js
// Async

// FIB=15
    HTTP
    http_req_duration...................... avg=45.31ms min=4ms    med=44.71ms max=224.92ms p(90)=47.61ms p(95)=48.95ms
      { expected_response:true }............: avg=45.31ms min=4ms    med=44.71ms max=224.92ms p(90)=47.61ms p(95)=48.95ms
    http_req_failed.........................: 0.00%  0 out of 21521
    http_reqs...............................: 21521  693.25117/s

// FIB=20

   HTTP
    http_req_duration.......................: avg=46.11ms min=5.38ms med=45.8ms  max=64.14ms p(90)=48.8ms  p(95)=49.89ms
      { expected_response:true }............: avg=46.11ms min=5.38ms med=45.8ms  max=64.14ms p(90)=48.8ms  p(95)=49.89ms
    http_req_failed.........................: 0.00%  0 out of 21147
    http_reqs...............................: 21147  680.809841/s

// FIB=25 (CPU 100%)
    HTTP
    http_req_duration.......................: avg=81.35ms min=17.23ms med=80.01ms max=145.84ms p(90)=93.04ms p(95)=94.12ms
      { expected_response:true }............: avg=81.35ms min=17.23ms med=80.01ms max=145.84ms p(90)=93.04ms p(95)=94.12ms
    http_req_failed.........................: 0.00%  0 out of 12001
    http_reqs...............................: 12001  386.028545/s

// FIB=30
    http_req_duration.......................: avg=801.08ms min=119.73ms med=612.18ms max=1.55s p(90)=1.31s p(95)=1.32s
      { expected_response:true }............: avg=801.08ms min=119.73ms med=612.18ms max=1.55s p(90)=1.31s p(95)=1.32s
    http_req_failed.........................: 0.00%  0 out of 1239
    http_reqs...............................: 1239   38.418509/s
```

```js
// Sync
// FIB=15
    HTTP
    http_req_duration.......................: avg=47.61ms min=4.24ms med=47.1ms  max=77.58ms p(90)=51.27ms p(95)=52.95ms
      { expected_response:true }............: avg=47.61ms min=4.24ms med=47.1ms  max=77.58ms p(90)=51.27ms p(95)=52.95ms
    http_req_failed.........................: 0.00%  0 out of 20482
    http_reqs...............................: 20482  659.715236/s

// FIB=20
   http_req_duration.......................: avg=48.22ms min=5.46ms med=47.44ms max=256.6ms  p(90)=51.55ms p(95)=53.4ms
      { expected_response:true }............: avg=48.22ms min=5.46ms med=47.44ms max=256.6ms  p(90)=51.55ms p(95)=53.4ms
    http_req_failed.........................: 0.00%  0 out of 20223
    http_reqs...............................: 20223  651.27536/s


// FIB=25
    http_req_duration.......................: avg=99.13ms min=19.32ms med=96.48ms max=165.13ms p(90)=125.04ms p(95)=133.03ms
      { expected_response:true }............: avg=99.13ms min=19.32ms med=96.48ms max=165.13ms p(90)=125.04ms p(95)=133.03ms
    http_req_failed.........................: 0.00%  0 out of 9851
    http_reqs...............................: 9851   316.789202/s


// FIB=30 (all cores are activated, but none at 100%)
  http_req_duration.......................: avg=935.97ms min=125.38ms med=832.32ms max=2.23s p(90)=1.48s p(95)=1.64s
      { expected_response:true }............: avg=935.97ms min=125.38ms med=832.32ms max=2.23s p(90)=1.48s p(95)=1.64s
    http_req_failed.........................: 0.00%  0 out of 1059
    http_reqs...............................: 1059   33.041639/s
```

## Workers = 1, VU = 32

```js
// Sync
// FIB=15

    HTTP
    http_req_duration.......................: avg=48.34ms min=4.53ms med=46.45ms max=289.37ms p(90)=61.22ms p(95)=69.48ms
      { expected_response:true }............: avg=48.34ms min=4.53ms med=46.45ms max=289.37ms p(90)=61.22ms p(95)=69.48ms
    http_req_failed.........................: 0.00%  0 out of 20266
    http_reqs...............................: 20266  648.879823/s

// FIB=20
    http_req_duration.......................: avg=77.52ms min=6.15ms med=76.1ms  max=205.53ms p(90)=95.08ms p(95)=104.63ms
      { expected_response:true }............: avg=77.52ms min=6.15ms med=76.1ms  max=205.53ms p(90)=95.08ms p(95)=104.63ms
    http_req_failed.........................: 0.00%  0 out of 12593
    http_reqs...............................: 12593  405.229952/s
// FIB=25

   HTTP
    http_req_duration.......................: avg=367.39ms min=26.76ms med=334.6ms  max=1.54s p(90)=545.69ms p(95)=663.63ms
      { expected_response:true }............: avg=367.39ms min=26.76ms med=334.6ms  max=1.54s p(90)=545.69ms p(95)=663.63ms
    http_req_failed.........................: 0.00%  0 out of 2670
    http_reqs...............................: 2670   85.248989/s

// FIB=30

   http_req_duration.......................: avg=3.43s min=156.77ms med=2.91s max=10.4s p(90)=5.68s p(95)=6.66s
      { expected_response:true }............: avg=3.43s min=156.77ms med=2.91s max=10.4s p(90)=5.68s p(95)=6.66s
    http_req_failed.........................: 0.00%  0 out of 299
    http_reqs...............................: 299    8.797787/s

```

```js
// Async

// FIB=15
    http_req_duration.......................: avg=33.4ms  min=2.95ms med=32.93ms max=62.78ms p(90)=37.36ms p(95)=39.4ms
      { expected_response:true }............: avg=33.4ms  min=2.95ms med=32.93ms max=62.78ms p(90)=37.36ms p(95)=39.4ms
    http_req_failed.........................: 0.00%  0 out of 29167
    http_reqs...............................: 29167  940.159632/s


// FIB=20
    http_req_duration.......................: avg=57.84ms min=5.88ms med=56.62ms max=90.64ms p(90)=65.38ms p(95)=67.54ms
      { expected_response:true }............: avg=57.84ms min=5.88ms med=56.62ms max=90.64ms p(90)=65.38ms p(95)=67.54ms
    http_req_failed.........................: 0.00%  0 out of 16866
    http_reqs...............................: 16866  543.210778/s



// FIB=25
    HTTP
    http_req_duration.......................: avg=307.15ms min=13.88ms med=309.54ms max=413.32ms p(90)=322.9ms p(95)=332.38ms
      { expected_response:true }............: avg=307.15ms min=13.88ms med=309.54ms max=413.32ms p(90)=322.9ms p(95)=332.38ms
    http_req_failed.........................: 0.00%  0 out of 3191
    http_reqs...............................: 3191   102.000747/s



// FIB=30
 HTTP
    http_req_duration.......................: avg=3.01s min=257.12ms med=3.12s max=4.01s p(90)=3.37s p(95)=3.41s
      { expected_response:true }............: avg=3.01s min=257.12ms med=3.12s max=4.01s p(90)=3.37s p(95)=3.41s
    http_req_failed.........................: 0.00%  0 out of 340
    http_reqs...............................: 340    9.985143/s
```

```js
// Async with await asyncio.create_task / asyncio.to_thread(fibonacci, FIB)

// FIB=15
    http_req_duration.......................: avg=37.57ms min=3.46ms med=37.54ms max=71.82ms p(90)=42.07ms p(95)=44.76ms
      { expected_response:true }............: avg=37.57ms min=3.46ms med=37.54ms max=71.82ms p(90)=42.07ms p(95)=44.76ms
    http_req_failed.........................: 0.00%  0 out of 25935
    http_reqs...............................: 25935  835.932105/s


// FIB=20
    http_req_duration.......................: avg=62.05ms min=7.28ms med=62.01ms max=150.61ms p(90)=69.55ms p(95)=73.32ms
      { expected_response:true }............: avg=62.05ms min=7.28ms med=62.01ms max=150.61ms p(90)=69.55ms p(95)=73.32ms
    http_req_failed.........................: 0.00%  0 out of 15724
    http_reqs...............................: 15724  506.418692/s

// FIB=25
    http_req_duration.......................: avg=355.38ms min=13.86ms med=359.71ms max=514.98ms p(90)=379.44ms p(95)=391.62ms
      { expected_response:true }............: avg=355.38ms min=13.86ms med=359.71ms max=514.98ms p(90)=379.44ms p(95)=391.62ms
    http_req_failed.........................: 0.00%  0 out of 2763
    http_reqs...............................: 2763   88.245227/s

// FIB=30

    http_req_duration.......................: avg=3.42s min=120.94ms med=3.6s max=4.18s p(90)=3.94s p(95)=4.05s
      { expected_response:true }............: avg=3.42s min=120.94ms med=3.6s max=4.18s p(90)=3.94s p(95)=4.05s
    http_req_failed.........................: 0.00%  0 out of 299
    http_reqs...............................: 299    8.862774/s

```

---

# Appendix

## Populate Database

```sql

-- 1) Drop tables in dependency order
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

-- 2) Users table
CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Products table
CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    title       TEXT NOT NULL,
    unit_price  NUMERIC(10, 2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) Orders table
CREATE TABLE orders (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    status      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 5) Order items ("cart items") table
CREATE TABLE order_items (
    id          BIGSERIAL PRIMARY KEY,
    order_id    BIGINT NOT NULL,
    product_id  BIGINT NOT NULL,
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(10, 2) NOT NULL,  -- snapshot of product price at the time of the order
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id),

    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 6) Indexes for relational queries
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_order_product ON order_items(order_id, product_id);

INSERT INTO users (id, name, email, created_at)
SELECT
    gs AS id,
    'user_' || gs AS name,
    'user_' || gs || '@example.com' AS email,
    NOW() - (random() * INTERVAL '365 days') AS created_at
FROM generate_series(1, 1_000_000) AS gs;

-- 8) Populate products: 100,000 rows
-- Generate random-ish titles and prices
WITH word_list AS (
    SELECT ARRAY[
        'Alpha','Beta','Gamma','Delta','Omega','Nova','Prime','Ultra','Max','Lite',
        'Turbo','Pro','Plus','Mini','Smart','Eco','Power','Magic','Ultra','Hyper',
        'Blue','Red','Green','Black','White','Silver','Gold','Quantum','Fusion'
    ] AS words
)
INSERT INTO products (title, unit_price, created_at)
SELECT
    wl.words[(floor(random() * array_length(wl.words, 1)) + 1)::int] || ' ' ||
    wl.words[(floor(random() * array_length(wl.words, 1)) + 1)::int] || ' ' ||
    wl.words[(floor(random() * array_length(wl.words, 1)) + 1)::int] AS title,
    round((random() * 500)::numeric, 2) AS unit_price,
    NOW() - (random() * INTERVAL '365 days') AS created_at
FROM generate_series(1, 100_000) AS gs
CROSS JOIN word_list AS wl;


INSERT INTO orders (id, user_id, status, created_at)
SELECT
    gs AS id,
    (floor(random() * 1000000) + 1)::BIGINT AS user_id,
    (ARRAY['pending','paid','cancelled','refunded'])[ (floor(random() * 4)::int + 1) ] AS status,
    NOW() - (random() * INTERVAL '365 days') AS created_at
FROM generate_series(1, 5_000_000) AS gs;

-- 10) Populate order_items: 1,000,000 rows
-- Each item links a random order and a random product, with quantity 1..5
-- unit_price is copied from products to simulate price snapshot at purchase time
WITH base AS (
    SELECT
        gs AS id,
        (floor(random() * 1000000) + 1)::BIGINT AS order_id,    -- 1..1,000,000
        (floor(random() * 100000) + 1)::BIGINT AS product_id,   -- 1..100,000
        (floor(random() * 5) + 1)::INT AS quantity              -- 1..5
    FROM generate_series(1, 10_000_000) AS gs
)
INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, created_at)
SELECT
    b.id,
    b.order_id,
    b.product_id,
    b.quantity,
    p.unit_price,
    NOW() - (random() * INTERVAL '365 days') AS created_at
FROM base b
JOIN products p ON p.id = b.product_id;

with sizeof as (
  SELECT 'users' AS table, COUNT(*) AS rows FROM users
  UNION ALL
  SELECT 'products' AS table, COUNT(*) AS rows FROM products
  UNION ALL
  SELECT 'orders' AS table, COUNT(*) AS rows FROM orders
  UNION ALL
  SELECT 'order_items' AS table, COUNT(*) AS rows FROM order_items
)
select * from sizeof
order by 2 desc
```


## Python Code

```py
def fibonacci(n: int) -> int:
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        return fibonacci(n - 1) + fibonacci(n - 2)


async def query_async_products(user_id: int):
    assert async_pool is not None, "Async pool not initialized"
    async with async_pool.connection() as aconn:
        async with aconn.cursor(row_factory=psy_rows.dict_row) as cur:
            await cur.execute(QUERY_ORDER, {"user_id": user_id})
            rows = await cur.fetchall()
    return pl.DataFrame(rows)


async def query_async_all_user_orders(user_id: int):
    assert async_pool is not None, "Async pool not initialized"
    async with async_pool.connection() as aconn:
        async with aconn.cursor(row_factory=psy_rows.dict_row) as cur:
            await cur.execute(ALL_USER_ORDERS_QUERY, {"user_id": user_id})
            rows = await cur.fetchall()
    return pl.DataFrame(rows)


@app.get("/async_simulation")
async def async_simulation_api(user_id: int = 821970):
    prod_rows_task = query_async_products(user_id)
    all_user_orders_task = query_async_all_user_orders(user_id)
    prod_rows, all_user_orders = await asyncio.gather(
        prod_rows_task, all_user_orders_task
    )
    total_qtd = int(all_user_orders["quantity"].sum())

    return {
        "total_qtd": total_qtd,
        "fib": fibonacci(min(total_qtd, 35)),
        "products": prod_rows.to_dict(as_series=False),
        "all_user_orders": all_user_orders.to_dict(as_series=False),
    }


def query_sync_products(user_id: int):
    assert sync_pool is not None, "Sync pool not initialized"
    with sync_pool.connection() as conn:
        with conn.cursor(row_factory=psy_rows.dict_row) as cur:
            cur.execute(QUERY_ORDER, {"user_id": user_id})
            rows = cur.fetchall()
    return pl.DataFrame(rows)


def query_sync_all_user_orders(user_id: int):
    assert sync_pool is not None, "Sync pool not initialized"
    with sync_pool.connection() as conn:
        with conn.cursor(row_factory=psy_rows.dict_row) as cur:
            cur.execute(ALL_USER_ORDERS_QUERY, {"user_id": user_id})
            rows = cur.fetchall()
    return pl.DataFrame(rows)


@app.get("/sync_simulation")
def sync_simulation_api(user_id: int = 821970):
    # Run two blocking queries in parallel using separate connections
    with ThreadPoolExecutor(max_workers=2) as executor:
        f_products = executor.submit(query_sync_products, user_id)
        f_all_orders = executor.submit(query_sync_all_user_orders, user_id)
        products = f_products.result()
        all_user_orders = f_all_orders.result()
    total_qtd = int(all_user_orders["quantity"].sum())

    return {
        "total_qtd": total_qtd,
        "fib": fibonacci(min(total_qtd, 35)),
        "products": products.to_dict(as_series=False),
        "all_user_orders": all_user_orders.to_dict(as_series=False),
    }

```
