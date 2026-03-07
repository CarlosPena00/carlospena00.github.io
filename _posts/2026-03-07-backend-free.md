---
layout: post
title: "Backend: Deploying in Free tier"
author: Carlos Pena
date: 2026-03-07
---

Running a backend in production doesn't have to cost anything — at least for a POC or early-stage product. This tutorial walks through deploying a full backend stack using only free tiers: a PostgreSQL database, object storage, Redis, and an always-on API server.

Here's the stack we'll use:

| Layer | Service | Free Tier |
|-------|---------|-----------|
| Database (PG) | [Supabase](https://supabase.com) | 500 MB HD, T4G.nano, 500MB Ram, 2 projects |
| Object Storage (S3) | Supabase Storage | 1 GB |
| Redis | [Upstash](https://upstash.com) | 10K commands/day, 256 MB |
| Backend hosting | [Koyeb](https://koyeb.com) | 0.1 vCPU, 512 MB RAM, 2 GB Disk |

Credit card may be required for any of them.

---

## 1. Database — Supabase (PostgreSQL + PostGIS)

Supabase gives you a managed PostgreSQL instance with PostGIS pre-installed, which is useful if your app needs geospatial queries.

**Step 1 — Create a project**

Go to [supabase.com](https://supabase.com), create an account, and start a new project. Save the database password — you'll need it shortly.

**Step 2 — Enable PostGIS**

Open the SQL editor in your Supabase project and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

Skip this step if your app doesn't need geospatial features.

**Step 3 — Run your migrations**

Use the direct connection string (not the pooler — `asyncpg` requires direct connections):

```bash
DATABASE_URL="postgresql+asyncpg://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?ssl=require" \
  uv run alembic upgrade head
```

**Step 4 — Configure your environment**

```bash
DATABASE_URL=postgresql+asyncpg://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?ssl=require
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=5
```

> The free Supabase tier supports ~60 direct connections. Keep `DATABASE_POOL_SIZE + DATABASE_MAX_OVERFLOW <= 15` to leave headroom for other clients and Supabase's own internals.

---

## 2. Object Storage — Supabase Storage

Supabase Storage is S3-compatible, so it works with any existing S3 client code. It's included in your project — no separate signup, no credit card, 1 GB free.

**Step 1 — Create a bucket**

1. Go to your project → **Storage** → **New bucket**
2. Name it (e.g. `my-app-media`)
3. Leave it **private** — presigned URLs will handle access so objects are never publicly exposed
4. Click **Save**

**Step 2 — Generate S3 credentials**

1. Go to **Project Settings** → **Storage**
2. Under **S3 Access Keys**, click **Generate new credentials**
3. Copy the **Access Key ID** and **Secret Access Key**
4. Note your **project ref** from the dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`

**Step 3 — Configure your environment**

```bash
AWS_ACCESS_KEY_ID=<access-key-id>
AWS_SECRET_ACCESS_KEY=<secret-access-key>
AWS_REGION=<your-supabase-region>   # e.g. us-east-1
S3_BUCKET_NAME=my-app-media
S3_ENDPOINT_URL=https://<project-ref>.supabase.co/storage/v1/s3
S3_PRESIGNED_URL_EXPIRY_SECONDS=3600
```

**Step 4 — CORS**

Supabase Storage has permissive CORS enabled by default for all origins. No manual configuration needed.


---

## 3. Redis — Upstash

Upstash provides managed Redis with a generous free tier: 10,000 commands/day and 256 MB. No server to maintain, and it scales seamlessly when you're ready to pay.

**Step 1 — Create an account**

Go to [upstash.com](https://upstash.com) and sign up. No credit card required.

**Step 2 — Create a Redis database**

1. Click **Create Database**
2. Give it a name (e.g. `my-app`)
3. Pick the region closest to your backend deployment (e.g. `us-east-1` for Koyeb Washington DC)
4. Type: **Regional** (free tier)
5. Click **Create**

**Step 3 — Copy the connection string**

In the database dashboard → **Details** tab → **REST API** section, find the **Redis URL**. It looks like:

```
rediss://default:<password>@<host>.upstash.io:6379
```

Note the `rediss://` scheme — Upstash always uses TLS.

**Step 4 — Configure your environment**

```bash
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379
```

> The free tier allows 10,000 commands/day. If your app enqueues ~3–5 Redis commands per job, that's thousands of jobs per day before you hit the limit. When you outgrow it, the pay-as-you-go plan starts at $0.20 per 100K commands.

---

## 4. Backend Hosting — Koyeb

Koyeb's free tier gives you two always-on services (512 MB RAM, 0.1 vCPU each) with no sleep and no cold starts — unlike many free hosting options. Perfect for running an API server and a background worker side by side.

**Step 1 — Create an account**

Sign up at [koyeb.com](https://koyeb.com).

**Step 2 — Deploy the API service**

1. Click **Create Service** → **Web Service**
2. Connect your GitHub repository
3. Configure the service:

| Setting | Value |
|---------|-------|
| **Builder** | Dockerfile |
| **Branch** | `main` |
| **Run command** | `uv run uvicorn src.main:app --host 0.0.0.0 --port 8000` |
| **Port** | `8000` |
| **Health check path** | `/health` |

4. Add your environment variables (see the full list below)
5. Click **Deploy**


**Step 4 — Set environment variables**

The minimum required set for production:

```bash
APP_ENV=production
DATABASE_URL=postgresql+asyncpg://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?ssl=require
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379
JWT_SECRET=<64-char-hex>
LOCATION_ENCRYPTION_KEY=<base64-32-bytes>
AWS_ACCESS_KEY_ID=<supabase-s3-key-id>
AWS_SECRET_ACCESS_KEY=<supabase-s3-secret>
AWS_REGION=<supabase-region>
S3_BUCKET_NAME=my-app-media
S3_ENDPOINT_URL=https://<project-ref>.supabase.co/storage/v1/s3
ALLOWED_ORIGINS=["https://your-app-domain.com"]
```

---

## What you end up with

After following this guide you have a fully functional backend running on free infrastructure:

- A PostgreSQL database with spatial support, managed and backed up by Supabase
- S3-compatible object storage in the same project, zero extra configuration
- A Redis instance for queues and caching via Upstash
- Two always-on services on Koyeb — one for the API, one for background workers

The total cost is $0 until you hit the free tier limits, at which point each service has a clear pay-as-you-go upgrade path.
