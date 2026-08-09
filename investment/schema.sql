-- Custom "Diagrama de investimentos" — Supabase schema + Row Level Security.
-- Run this once in the Supabase SQL editor (SQL → New query → Run).
-- All data is scoped to the authenticated user via RLS.

-- Portfolios: one account can own several (e.g. yours + your sister's).
create table if not exists portfolios (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id             uuid primary key default gen_random_uuid(),
  portfolio_id   uuid not null references portfolios (id) on delete cascade,
  name           text not null,
  value          numeric not null default 0 check (value >= 0),
  nota           int not null default 0 check (nota between -1 and 10),
  category       text not null,
  subcategory    text,
  subsubcategory text,
  created_at     timestamptz not null default now()
);
create index if not exists assets_portfolio_idx on assets (portfolio_id);

-- Desired allocation per category (one row per category).
create table if not exists category_targets (
  portfolio_id uuid not null references portfolios (id) on delete cascade,
  category     text not null,
  target_pct   numeric not null default 0 check (target_pct >= 0 and target_pct <= 100),
  primary key (portfolio_id, category)
);

-- Optional maximum allocation for a subcategory (as % of its category).
create table if not exists subcategory_caps (
  portfolio_id uuid not null references portfolios (id) on delete cascade,
  category     text not null,
  subcategory  text not null,
  max_pct      numeric not null check (max_pct >= 0 and max_pct <= 100),
  primary key (portfolio_id, category, subcategory)
);

-- ---------- Row Level Security ----------
alter table portfolios       enable row level security;
alter table assets           enable row level security;
alter table category_targets enable row level security;
alter table subcategory_caps enable row level security;

-- Portfolios: the owner can do everything with their own rows.
create policy portfolios_owner_all on portfolios
  for all
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- Child tables: access only if the parent portfolio belongs to the user.
create policy assets_owner_all on assets
  for all
  using (portfolio_id in (select id from portfolios where owner = auth.uid()))
  with check (portfolio_id in (select id from portfolios where owner = auth.uid()));

create policy targets_owner_all on category_targets
  for all
  using (portfolio_id in (select id from portfolios where owner = auth.uid()))
  with check (portfolio_id in (select id from portfolios where owner = auth.uid()));

create policy caps_owner_all on subcategory_caps
  for all
  using (portfolio_id in (select id from portfolios where owner = auth.uid()))
  with check (portfolio_id in (select id from portfolios where owner = auth.uid()));
