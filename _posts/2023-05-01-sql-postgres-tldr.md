---
layout: post
title: "DB: SQL Postgres: TL;DR"
author: Carlos Pena
date: 2023-05-01
---

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

# On Conflict

Equivalent to MERGE.

- ON CONFLICT (name): Specifies the unique constraint or index to check for conflicts.

- DO:
    - Update: Updates the selected columns based on `EXCLUDED` table;
        > EXCLUDED: A special table reference representing the values that were attempted to be inserted.

    - Nothing: suppress the warning:
        > SQL Error [23505]: ERROR: duplicate key value violates unique constraint "foo"
  Detail: Key (bar)=(val) already exists.

```sql
CREATE TEMPORARY TABLE chcp_users (
    id SERIAL PRIMARY KEY,
    cpf TEXT UNIQUE,
    name text,
    age numeric
);


INSERT INTO chcp_users (cpf, name, age)
VALUES ('11122233345', 'Carlos Pena', 27)
ON CONFLICT (cpf)
DO UPDATE SET
	name = EXCLUDED.name,
	age = EXCLUDED.age;

select * from chcp_users
-- 1	11122233345	Carlos Pena	27

INSERT INTO chcp_users (cpf, name, age)
VALUES ('11122233345', 'Carlos H C Pena', 28)
ON CONFLICT (cpf)
DO UPDATE SET
	name = EXCLUDED.name,
	age = EXCLUDED.age;

select * from chcp_users
-- 1	11122233345	Carlos H C Pena	28


INSERT INTO chcp_users (cpf, name, age)
VALUES ('11122233345', 'AAAAAAAAA', -1)
ON CONFLICT (cpf)
DO nothing
-- Updated Rows: 0 (error has been suppressed)

select * from chcp_users
-- 1	11122233345	Carlos H C Pena	28
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

# Full-Text Search

```sql
create table if not exists documents (
    id SERIAL PRIMARY KEY,
    title TEXT,
    content TEXT,
    tsv_content tsvector null,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tsv_content ON documents USING gin(tsv_content);

-- Create a trigger to calculate tsv
create or replace function calc_tsv()
returns trigger as $$
begin
    new.tsv_content := to_tsvector('english', new.title || ' ' || new.content);
    return new;
end;
$$ language plpgsql;

create trigger trigger_calc_tsv
before insert or update on documents
for each row
execute function calc_tsv();
-- drop trigger trigger_calc_tsv on documents;

-- Sample from chatgpt :D
INSERT INTO documents (title, content)
VALUES
('PostgreSQL Full-Text Search Guide', 'This guide covers how to perform full-text search in PostgreSQL. It includes creating tsvectors, tsqueries, and indexing.'),
('Introduction to Database Indexing', 'Database indexing improves the speed of data retrieval operations on a table. This tutorial explains how indexes work in databases like PostgreSQL and MySQL.'),
('Advanced Search Techniques', 'Learn how to implement advanced search techniques in PostgreSQL. This includes phrase search, prefix search, and ranking results by relevance.'),
('What is SQL?', 'Structured Query Language, or SQL, is a standard programming language for managing relational databases. It is used to perform queries, update data, and more.'),
('PostgreSQL vs MySQL: A Comparison', 'In this article, we compare PostgreSQL and MySQL in terms of performance, scalability, and support for advanced features like full-text search.'),
('Building a REST API with FastAPI', 'This tutorial shows how to build a REST API using FastAPI, including endpoints for creating, reading, updating, and deleting data.'),
('Data Engineering Best Practices', 'Data engineering involves building systems for collecting, storing, and analyzing data. This article discusses the best practices in data pipeline design, scalability, and optimization.'),
('Python and SQL for Data Analysis', 'Learn how to combine Python with SQL for powerful data analysis. This tutorial covers using libraries like pandas and SQLAlchemy to query databases efficiently.'),
('Understanding GIN Indexes in PostgreSQL', 'GIN indexes are essential for efficient full-text search in PostgreSQL. This guide explains how to create and use GIN indexes to speed up searches.'),
('Optimizing Queries in PostgreSQL', 'Query optimization is key to improving database performance. This guide covers query planning, indexing strategies, and analyzing query performance.')
('Introduction to Machine Learning', 'Machine learning is a field of artificial intelligence that uses statistical techniques to give computer systems the ability to learn from data. This article covers the basic concepts.'),
('Supervised vs Unsupervised Learning', 'This document explains the key differences between supervised and unsupervised learning, with examples of common algorithms used in each approach.'),
('Deep Learning for Image Recognition', 'Deep learning has revolutionized image recognition, enabling machines to achieve superhuman accuracy. This article discusses popular models like Convolutional Neural Networks (CNNs).'),
('Building a Neural Network from Scratch', 'Learn how to build a neural network from scratch using Python. This tutorial walks through each step, including forward propagation, backpropagation, and gradient descent.'),
('Natural Language Processing with Machine Learning', 'This document covers natural language processing (NLP) techniques and how machine learning models, such as recurrent neural networks (RNNs) and transformers, are applied to text data.'),
('Implementing a Recommendation System', 'Recommendation systems use machine learning to provide personalized suggestions. This article explains collaborative filtering and content-based recommendation algorithms.'),
('Transfer Learning in Deep Learning', 'Transfer learning allows models to leverage pre-trained weights from other tasks to solve new problems. This article explains how transfer learning works and its applications.'),
('Reinforcement Learning: An Overview', 'Reinforcement learning is a type of machine learning where agents learn to make decisions by receiving rewards or penalties. This article explores Q-learning, policy gradients, and other RL techniques.'),
('Training a Deep Learning Model with TensorFlow', 'TensorFlow is a popular open-source framework for training deep learning models. This guide covers setting up the environment, defining models, and training them on datasets.'),
('Bias and Variance in Machine Learning Models', 'Understanding the tradeoff between bias and variance is critical for building accurate models. This article explains these concepts and how to address overfitting and underfitting.'),
('Hyperparameter Tuning for Machine Learning Models', 'Hyperparameter tuning can significantly improve model performance. Learn about techniques like grid search, random search, and Bayesian optimization to find the best model parameters.'),
('AI Ethics and Fairness in Machine Learning', 'As AI systems become more integrated into society, ensuring fairness and avoiding bias in machine learning models has become crucial. This article delves into the ethical challenges of AI development.');
```

### Search

```sql
-- Search for 'Machine' and 'System'
SELECT id, title, ts_rank(d.tsv_content, to_tsquery('Machine & System')) AS rank
FROM documents d
WHERE d.tsv_content @@ to_tsquery('Machine & System')
/*
    Introduction to Machine Learning
    Implementing a Recommendation System
    AI Ethics and Fairness in Machine Learning
*/

-- Search for 'Machine' and 'Learning' that are not together
SELECT * FROM documents
WHERE tsv_content @@ to_tsquery('english', 'machine & learning')
EXCEPT
SELECT * FROM documents
WHERE tsv_content @@ to_tsquery('english', 'machine <-> learning') -- 'Machine' Near to 'Learning'
/*
    1) Deep Learning for Image Recognition; Deep learning has revolutionized image recognition,
    enabling machines to achieve superhuman accuracy. This article discusses popular models
    like Convolutional Neural Networks (CNNs).
*/

-- Search for 'Deep' and 'learning' and NOT 'machine'
SELECT * FROM documents
WHERE tsv_content @@ to_tsquery('english', '!machine & learning & Deep')
/*
    Transfer Learning in Deep Learning
    Training a Deep Learning Model with TensorFlow
*/

-- Search for all words starting with "Postg*"
SELECT * FROM documents d
WHERE d.tsv_content @@ to_tsquery('Postg:*')
/*
    PostgreSQL Full-Text Search Guide
    PostgreSQL vs MySQL: A Comparison
    Understanding GIN Indexes in PostgreSQL
    Optimizing Queries in PostgreSQL
    ...
*/
```

---

# Differential Updates

For this example we will create three product tables: `prod_price`, `prod_stock`, `prod_info`
and they will be summarized in the `prod_sumarização` table.


```sql
-- Create Data/Structure
CREATE TABLE prod_price (
    product_id INT NOT NULL,
    store_id INT NOT NULL,
    price NUMERIC(10, 2),
    PRIMARY KEY (product_id, store_id)
);

INSERT INTO prod_price (product_id, store_id, price)
VALUES
    (1, 101, 19.99),
    (1, 102, 10.00),
    (1, 103, 20.00),
    (1, 104, NULL),
    (2, 101, NULL),
    (2, 102, 29.99),
    (2, 103, 29.99),
    (3, 103, 14.49),
    (4, 101, 9.99),
    (4, 999, 9.99),
    (5, 102, 39.99),
    (999, 102, 39.99),
    (999, 105, NULL);


CREATE TABLE prod_stock (
    product_id INT NOT NULL,
    store_id INT NOT NULL,
    stock INT NOT NULL,
    PRIMARY KEY (product_id, store_id)
);

INSERT INTO prod_stock (product_id, store_id, stock)
VALUES
    (1, 101, 50),
    (1, 102, 0),
    (1, 103, 3),
    (2, 101, 1),
    (2, 102, 30),
    (3, 103, 100),
    (3, 104, 1),
    (3, 105, 5),
    (4, 101, 10),
    (4, 888, 10),
    (5, 102, 0);
    (888, 102, 10);

CREATE TABLE if not exists prod_info(
    product_id INT PRIMARY KEY,
    title TEXT NOT NULL,
    tags TEXT[],
    description TEXT
);

INSERT INTO prod_info (product_id, title, tags, description)
VALUES
    (1, 'Wireless Mouse', ARRAY['electronics', 'peripherals'], 'Compact and ergonomic design.'),
    (2, 'Gaming Keyboard', ARRAY['electronics', 'gaming'], 'Mechanical keys with RGB lighting.'),
    (3, 'USB-C Cable', ARRAY['electronics', 'accessories'], 'Durable and fast charging.'),
    (4, 'Notebook Stand', ARRAY['office', 'ergonomics'], 'Adjustable aluminum stand for laptops.'),
    (5, 'Noise Cancelling Headphones', ARRAY['electronics', 'audio'], 'Over-ear headphones with ANC.');


CREATE TABLE prod_summarization (
    product_id INT NOT NULL,
    store_id INT NOT NULL,
    price NUMERIC(10, 2),
    stock INT,
    title TEXT,
    tags TEXT[],
    description TEXT,
    PRIMARY KEY (product_id, store_id)
);

-- Create a temporary table to help identify removed/added/changed items.
create table temp_prod_summarization as table prod_summarization with no data;
-- This temp table has no index/pk

delete from temp_prod_summarization;

-- Add data into a empty temp_prod_summarization
insert into temp_prod_summarization
	(product_id, store_id, price, stock, title, tags, description)
SELECT
    p.product_id,
    p.store_id,
    p.price,
    s.stock,
    i.title,
    i.tags,
    i.description
FROM prod_price p
JOIN prod_stock s
    ON p.product_id = s.product_id AND p.store_id = s.store_id
JOIN prod_info i
    ON p.product_id = i.product_id
where 1=1
	and s.stock > 0
	and p.price > 0  --and 'ergonomics'=any(i.tags)

-- Add/Update data
INSERT INTO prod_summarization (
    product_id, store_id, price, stock, title, tags, description
)
SELECT
    product_id, store_id, price, stock, title, tags, description
FROM temp_prod_summarization
ON CONFLICT (product_id, store_id)
DO UPDATE SET
    price = EXCLUDED.price,
    stock = EXCLUDED.stock,
    title = EXCLUDED.title,
    tags = EXCLUDED.tags,
    description = EXCLUDED.description
WHERE prod_summarization.price <> EXCLUDED.price
   OR prod_summarization.stock <> EXCLUDED.stock
   OR prod_summarization.title <> EXCLUDED.title
   OR prod_summarization.tags <> EXCLUDED.tags
   OR prod_summarization.description <> EXCLUDED.description;

-- Delete Data from prod_summarization
DELETE FROM prod_summarization
WHERE (product_id, store_id) NOT IN (
    SELECT product_id, store_id FROM temp_prod_summarization
);

-- Remember to keep temp_prod_summarization empty
delete from temp_prod_summarization;

-- TODO: Test this strategy with more data
```

---

# TL;DR Of A Curious Moon

I recently read the PostgreSQL book/tutorial [A Curious Moon](https://bigmachine.io/products/a-curious-moon/). And I decided to do a TL;DR (similar to the previous post about Oracle SQL), although this time focused on the teachings of the book.

The TLDR as well as the code used can be found in the repository: [tldr_a_curious_moon](https://github.com/CarlosPena00/tldr_a_curious_moon).

- [https://github.com/CarlosPena00/tldr_a_curious_moon](https://github.com/CarlosPena00/tldr_a_curious_moon)


The idea of the post is to have a streamlined version of the teachings I had per chapter, focused on the Postgres itself. I found it interesting to change the database to avoid a simple copy/paste by myself. I chose a public dataset from the Brazilian government regarding [confiscated cigarettes (and destroyed)](https://dados.gov.br/dados/conjuntos-dados/destinacoes-de-mercadorias-apreendidas), that I may (or may not) change in the future.

> [A Curious Moon by Rob Conery](https://bigmachine.io/products/a-curious-moon/)

## Before the book

In this section we will use docker-compose to run a local postgres instance, to start run:

```js
docker compose up --remove-orphans [-d]
```

---

## Transit

- Respect the ETL (extract, [transform](sql/normalize.sql), load)
- Before a `create` must have a `drop * if exists [cascade]`
- Create a [schema](sql/import.sql) just for importing the data with text type
- Put everything in an idempotent script (same input same output)

## In Orbit

- Create lookup tables: reduce repetitions and could speedup search. A new table with all distinct values from the given column (of the import.* table), with a primary key (that will be used as foreign key)
- Date in Postgres is stored as a UTC
- TIMESTAMPT: values in UTC
- TIMESTAMPTZ: converts TIMESTAMP values (UTC) to the client's session time zone
- make clean && [make](Makefile)

## Flyby

- A query is `Sargable`(Search ARGument ABLE) if it can take advantage of an index to speed up the execution of the query
- Avoid `LIKE %*` as it is `non-sargable`
- `ILIKE` is case-insensitive

## A Bent Field

- Create a view to make querying easier (and drop if exists)
- \x: toggle expanded display (table vs record by record)
- \H: change output to html layout
- \o file_name: change output to a file
- Full-text indexing: `to_tsvector(my_text_column)` and `search @@ to_tsquery('my_search_query')`
- GIN: Generalized Inverted Index (key, posting list)
- Materialized View: a view does not store data, a `Materialized View` is stored in disk (and so, allowed to create an index). Once the original data is updated, it is necessary to update the materialized view: `REFRESH MATERIALIZED VIEW my_view_name`

## Sniff The Sky

- Don't burn yourself out
- Count how many files follow the pattern: `ls */*.txt | wc -l`
- [csvkit](https://csvkit.readthedocs.io/en/latest/): command-line tools for converting to and working with CSV, such as:
  - in2csv: convert * to CSV
  - csvcut -n: print column names
  - csvsql: import into PostgreSQL (remember to replace varchar to text)

> csvsql my_csv_path -i postgresql --tables "import.my_name" --noconstraints –overwrite | sed 's/VARCHAR/text/g' > import.sql

- Using `cut` command to retrieve the desired columns: `cut -d ';' -f 1-2,4-6  user_data/cigarros.csv`
- CTE (Common Table Expression): `with temp_table_name as ( select ...), other_name as (select ... where temp_table_name.x = 2) select * from other_name`

```sql
with count_events as (select count(*) from events),
     count_regions as (select count(*) from regions)
select * from count_events, count_regions;
```

## Ring Dust
- PostgreSQL support the following languages: PL/pgSQL, PL/Tcl, PL/Perl, and PL/Python.

```sql
drop function if exists my_function(arguments_types);
create function my_function (arguments)
returns return_datatype
IMMUTABLE -- if pure function (no side effects, same input same output)
as $$
   declare
      ...
   begin
      ...
      return my_return_value
   end;
$$ language sql;
```
Or similar to the one presented in the book

```sql
drop function if exists max_price_per_region(int);
create function max_price_per_region(rid int, out numeric)
as $$
    select max(price) from events where events.region_id=rid
    -- implicity return the first row of this select
$$ language sql;
```

To other languages, such as python, it is necessary to run `CREATE LANGUAGE [plpython3u]` that requires installing python itself along with Postgres.

- Window function: similar to aggregation without grouping rows `count(1) over (partition by ...)` (you may want to add `distinct` in after the `select`)

as example, the percentage of entries per year with max/min price per year.

```sql
select distinct
    year,
    round(100.0 * (count(1) over (partition by year)::numeric
            / (count(1) over())::numeric), 2) as percentage_of_entries,
    (max(price) over (partition by year)::numeric
            / (count(1) over())::numeric) as max_price,
    (min(price) over (partition by year)::numeric
            / (count(1) over())::numeric) as min_price
from events;
```

## A Tight Ship

- Chapter dedicated to explaining 'why to choose postgres'
- [PostgreSQL License](https://www.postgresql.org/about/licence/): liberal Open Source license, similar to the BSD or MIT licenses. [You can distribute, modify and commercial use](https://www.tldrlegal.com/license/postgresql-license-postgresql).
- Price per hour comparison on AWS-RDS with db.t3.xlarge (16GB, 4vCPU): $0.60 [oracle](https://aws.amazon.com/rds/oracle/pricing/) vs $0.29 [Postgres](https://aws.amazon.com/rds/postgresql/pricing/)
- [MVCC](https://www.postgresql.org/docs/7.1/mvcc.html) (Multi-Version Concurrency Control): locks acquired for querying (reading) data don't conflict with locks acquired for writing data. (reading doesn't blocks writing, and writing doesn't blocks reading).
- For writing: the data is lifted into virtual memory, only when the transaction is complete is the entire change written to disk in one operation.

## Gravity Assist

- You (unfortunately) may add bias to the data (but avoid it)
- Occam's razor: the simplest explanation is usually the best one
- The Temporary table is automatically dropped at the end of a session / current transaction `CREATE TEMPORARY TABLE my_temp_table_name`

## Under The Ice

- Use `explain [analyze] my_query` to shows the execution plan of a query, it is important to check its `cost` and its `scans`
- The `cost` is a relative measurement, which you may want to minimize.
- There are several ways to scan a table such as `sequential scan`, `index scan`, ...
- `\d my_element` describes a element (table, view, index, ...)
- In a many-to-many (N:M) relationship, a `junction table` is used to support relationship between two tables. The junction table contains the two foreign keys and creates its own primary key using those two foreign keys.
- In postgres is possible to index with `where` (e.g.: index where a column is not null), and also `concurrently` (without paying)
- BTREE index (balanced tree)
- Also the `tsrange` (timestamp range) in which you define a window (start, end) and inclusive/exclusive options.
- [Other range options](https://www.postgresql.org/docs/current/rangetypes.html): `int4range`, `numrange`, `daterange` ...
- [Ranges Types: Your Life Will Never Be The Same ](https://wiki.postgresql.org/images/7/73/Range-types-pgopen-2012.pdf)
- To query ranges, use `@>` e.g: `SELECT int4range(10, 30) @> 20`, to compute the intersection between two ranges use `*`, and to check if the ranges overlaps, use `&&`
- Remember to create a new index using GIST (Generalized Search Tree) on the ranges (if you wish)
- However, if you are using a range to constrain results it may not help (as Dee problem)

## Glide Path and Epilog
- Time for plot
- Overall, I loved this book! I never thought a tutorial could be so well done
- Please, feel free to contribute to more lessons :D
