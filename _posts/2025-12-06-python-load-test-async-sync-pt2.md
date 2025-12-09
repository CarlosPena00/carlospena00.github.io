---
layout: post
title: "Python: Load Test with FastAPI - Sync vs Async - Pt2 Docker"
author: Carlos Pena
date: 2025-12-08
---




# Appendix

## Docker Config

- Dockerfile

```Dockerfile
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY . /app
WORKDIR /app
RUN uv sync --frozen --no-cache
CMD ["uv", "run", "python", "-m", "load_db"]
```

- docker-compose.yaml

```yaml
version: '3'

services:
  worker:
    build: .
    security_opt:
      - seccomp:unconfined
    ports:
      - "8000:8000"
    deploy:
      resources:
        limits:
          cpus: "1"
```

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
