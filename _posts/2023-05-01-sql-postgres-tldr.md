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

# Numrange index

- Remember that `COST` is not everything
- The efficiency of the index will depend on the number of expected lines

```sql
CREATE TABLE example_table (
    start_num NUMERIC,
    end_num NUMERIC,
    text_column text
);


CREATE OR REPLACE PROCEDURE populate_table(
    in_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
	i INTEGER := 1;
	random_st INTEGER := 0;
	random_range INTEGER :=  0;
BEGIN
    WHILE i <= in_count loop
		random_st := random() * 1000;
		random_range :=  random() * 1000;

	    INSERT INTO example_table (start_num, end_num, text_column)
        VALUES (random_st, random_st+random_range, 'Row ' || i);
        i := i + 1;
    END LOOP;
END;
$$;

CALL populate_table(2000000);


select * from example_table
where
	100 >= start_num and
	100 <= end_num;
-- COST 0.00 - 42739.00 -- Seq Scan
create index idx_example_table_start on example_table(start_num);
create index idx_example_table_end on example_table(end_num);
create index idx_example_table_start_end on example_table(start_num, end_num desc);


select * from example_table
where
	100 >= start_num and
	100 <= end_num;
-- COST 3798.16 - 19575.96 -- Bitmap Heap Scan (idx_example_table_start)

select * from example_table
where
	100 between start_num and end_num;
-- COST 3798.16 - 19575.96 -- Bitmap Heap Scan (idx_example_table_start)


create index idx_example_table_range_gist ON example_table using gist (numrange(start_num, end_num, '[]' ));
-- GiST (Generalized Search Tree)

select * from example_table
where
	numeric '100' <@ numrange(start_num, end_num, '[]');
-- COST 385.91 - 13086.03 -- Bitmap Heap Scan (idx_example_table_range_gist)
```

# Trigger

- Example: Add a field to an existing table

```sql
-- Dummy table with some data
create temporary table example_table (
    alfa int,
    beta int
);

insert into example_table values(1, 2);
insert into example_table values(10, 30);
insert into example_table values(10, 10);
insert into example_table values(10, 0);
select * from example_table;
```

```sql
-- Add third column `gamma` that will hold the value of `alfa` + `beta`
alter table example_table
add column gamma int;

-- Create trigger to calculate `gamma` for new data
create or replace function calculate_gamma()
returns trigger as $$
begin
    new.gamma := new.alfa + new.beta;
    return new;
end;
$$ language plpgsql;

create trigger trigger_calculate_gamma
before insert on example_table
for each row
execute function calculate_gamma();

insert into example_table values(0, 0);
insert into example_table values(1, 1);
-- will work, but the old values will continue with null values of gamma

update example_table
set gamma = alfa + beta;
-- update all rows
```
