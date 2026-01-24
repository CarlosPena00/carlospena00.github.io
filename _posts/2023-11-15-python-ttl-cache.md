---
layout: post
title: "Python: Time To Live (TTL) Cache"
author: Carlos Pena
date: 2022-11-15
---

- How to cache data with `cachetools.func` and `Redis` in python

Imagine that your application is slow or overloading the database, for example. But there is a possibility, caching the data, with one limitation, the data cannot be too outdated.

## Database

Create a dummy oracle db to simulate a real environment

```py
docker run -d -p 1521:1521 -e ORACLE_PASSWORD=pass -v oracle-volume:/opt/oracle/oradata gvenzl/oracle-xe
```

Create a connection pool in python

```py
import oracledb
ora_conn = "system/pass@localhost:1521/xe"
# USER/PASS@IP:PORT/SID
pool = oracledb.ConnectionPool(ora_conn, max=4)
```

Execute a select

```py
from typing import Any

def sql(query: str) -> dict[str, Any]:
    with pool.acquire() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query)
            data = cursor.fetchall()
            cols = [col[0] for col in cursor.description]
    return {"columns":cols, "data": data}
```

Create two example queries

```py
query_dummy = "select * from my_table"
sql(query_dummy)
# 182 µs ± 10.3 µs per loop (mean ± std. dev. of 7 runs, 10,000 loops each)

query_slow = """
    SELECT LEVEL FROM dual
    CONNECT BY LEVEL <= 1000000
"""
sql(query_slow)
# 1.01 s ± 99 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```


## TTL Cachetools

The Cachetools library is an excellent form of caching, it is quick and easy to implement, and it has a variety of types (ttl, lru, lfu, ...).

The main disadvantage is if it is necessary to share the cache in separate processes (other pods or applications).

```py
@cachetools.func.ttl_cache(maxsize=128, ttl=10 * 60) # 10m
def cached_sql(query: str) -> dict[str, Any]:
    with pool.acquire() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query)
            data = cursor.fetchall()
            cols = [col[0] for col in cursor.description]
    return {"columns":cols, "data": data}
```

Lets cache the slow query

```py
cached_sql(query_slow); # cache it
# 1.05 s
```

Run it after cache

```py
cached_sql(query_slow)
# 1.17 µs ± 6.74 ns per loop (mean ± std. dev. of 7 runs, 1,000,000 loops each)
```

## Redis

To make it easier to use redis, let's choose a version with json support

```py
docker run -p 6379:6379 --name redis-stack redis/redis-stack:latest
pip install redis[hiredis]
```

If the cache hit (aka result is not None) return the cached response. Otherwise, execute select into the database and store in redis with a ttl

```py
from typing import Any
import redis
from redis.commands.json.path import Path

client_redis = redis.Redis(host='localhost', port=6379, decode_responses=True)

def redis_sql(query: str, ttl_s: int=10) -> dict[str, Any]:
    result = client_redis.json().get(query)
    if result is not None:
        return result

    with pool.acquire() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query)
            data = cursor.fetchall()
            cols = [col[0] for col in cursor.description]
    result = {"columns":cols, "data": data}
    is_success = client_redis.json().set(query, Path.root_path(), result)
    client_redis.expire(query, ttl_s)
    assert is_success
    return result
```
Lets cache the slow query

```py
redis_sql(query_slow); # cache it
# 1.21 s
```
Run it after cache

```py
cached_sql(query_slow)
# 174 ms ± 37 ms per loop (mean ± std. dev. of 7 runs, 10 loops each)
```

- We can reduce the number of roundtrips by using Redis pipeline.

```py
pipe = client_redis.pipeline()
pipe.get("my_key")
pipe.get("my_key2")
pipe.expire("my_key", 10)
pipe.execute() # One roundtrip with 2 gets and one "expire"
```

### Conclusion

The cachetools library provides a simple way to cache data quickly, with the disadvantage that storage is concentrated in a specific process, which is, for instance, a problem for applications with multiple nodes.

An alternative to the problem is to use a specific database for caching, as is the case with Redis, which, however, has a greater latency, and it is necessary to monitor another structure and guarantee communication between the application and Redis.
