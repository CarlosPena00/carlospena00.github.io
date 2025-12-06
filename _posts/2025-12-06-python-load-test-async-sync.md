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
