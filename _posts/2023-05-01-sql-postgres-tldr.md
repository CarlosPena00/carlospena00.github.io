---
layout: post
title: "SQL Postgres: TL;DR"
author: Carlos Pena
date: 2023-05-01
---

I recently read the PostgreSQL book/tutorial [A Curious Moon](https://bigmachine.io/products/a-curious-moon/). And I decided to do a TL;DR (similar to the previous post about Oracle SQL), although this time focused on the teachings of the book.

The TLDR as well as the code used can be found in the repository: [tldr_a_curious_moon](https://github.com/CarlosPena00/tldr_a_curious_moon).

- [https://github.com/CarlosPena00/tldr_a_curious_moon](https://github.com/CarlosPena00/tldr_a_curious_moon)

# Install

Start Postgres DB with [docker](https://docs.docker.com/engine/install/ubuntu/)

```sql
$ docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pass \
    -v pgdata:/data/postgres -v user_data:/user_data docker.io/postgres

-- To Connect
$ psql postgres://postgres:pass@localhost:5432
```

# Data Validation

```sql
drop domain if exists address_num_type cascade;
create domain address_num_type AS integer
check (VALUE > 0 and VALUE < 10000);

drop domain if exists cep_type cascade;
create domain cep_type AS TEXT
check(
   	VALUE ~ '^\d{7,8}$'
 	OR VALUE ~ '^\d{5}-\d{3}$'
);

drop table ADDRESS;
create table ADDRESS(
  id serial primary key,
  num address_num_type not null,
  cep cep_type not null
);

insert into ADDRESS values (default, 20, '50000000');
-- Done
insert into ADDRESS values (default, -1, '50000000');
-- SQL Error [23514]: ERROR: value for domain address_num_type violates check
-- constraint "address_num_type_check"
insert into ADDRESS values (default, 20, '500');
-- SQL Error [23514]: ERROR: value for domain cep_type violates check
-- constraint "cep_type_check"
```
