---
layout: post
title: "SQL Oracle: TL;DR"
author: Carlos Pena
date: 2022-12-24
---

# Install and Config

Start a Oracle Express DB with [docker](https://docs.docker.com/engine/install/ubuntu/)
```sql
$ docker run -d -p 1521:1521 -e ORACLE_PASSWORD=pass \
  -v oracle-volume:/opt/oracle/oradata gvenzl/oracle-xe
```

## SQL Developer

Create a connection on [SQL Developer](https://www.oracle.com/database/sqldeveloper/technologies/download/)

<p float='left'>
<img  src="../../../assets/images/sql_dev_conn.png" alt="image" width="40%">
</p>

```sql
sql developer (new connection):
    username: system
    password: <PASS>
    Conn type: Basic
        hostname: localhost
        port: 1521
        SID: xe
```

# Misc
```sql
SET SERVEROUTPUT ON;
exec DBMS_OUTPUT.PUT_LINE('this is a print ' || 'function');
```

# DDL – Data Definition Language

## Create

```sql
CREATE TABLE my_table(
    id NUMBER NOT NULL,
    col_num0 NUMBER,
    col_num1 NUMBER,
    col_char VARCHAR(255),
    PRIMARY KEY(id)
);

-- From other table
CREATE TABLE my_other_table AS
(SELECT * FROM MY_TABLE);

CREATE UNIQUE INDEX col_char ON my_table(col_char);
CREATE INDEX index_num ON my_table(col_num0, col_num1);
```
## Drop

```sql
DROP TABLE my_table;

DROP INDEX index_id;
```

# DML – Data Manipulation Language

## INSERT INTO

```sql
INSERT INTO my_table
    (id, col_num0, col_num1, col_char)
VALUES
    (1, 10, 100, 'First Table');

-- With Select (direct values from dual)
INSERT INTO my_table
    (id, col_num0, col_num1, col_char)
SELECT 2, 20, 200, 'First Table' FROM DUAL UNION
SELECT 3, 30, 300, 'First Table' FROM DUAL

-- With Select (from other table)
INSERT INTO my_other_table
    (id, col_num0, col_num1, col_char)
SELECT
    id+100, col_num0*2, col_num1*col_num1, 'other table'
FROM my_table;

```
## Update

```sql
UPDATE my_table
  SET col_num0=0, col_char='updated'
WHERE
    ID >= 2
```

## Delete

```sql
DELETE FROM my_table
WHERE ID=1
-- Warning: the WHERE is `optional`
```

# PL/SQL

## Anonymous block

```sql
DECLARE
      my_var NUMBER;
BEGIN
   SELECT count(*)
   INTO my_var
   FROM my_table;

   DBMS_OUTPUT.PUT_LINE( my_var );
END;
```

## Function

The Functions cannot be used to perform actions that modify the database (insert/update/delete).

```sql
CREATE OR REPLACE FUNCTION plus_three (my_num IN NUMBER) RETURN NUMBER
AS
    res NUMBER;
BEGIN
    res := my_num + 3;
    return res;
END;

-- example:
SELECT plus_three(2) FROM dual;
```

## Procedure
```sql
CREATE OR REPLACE PROCEDURE update_to_alpha_square
    (target_id IN NUMBER, alpha IN NUMBER)
IS
    res NUMBER;
BEGIN
    res := alpha * alpha;
    -- it does not require `EXEC`
    DBMS_OUTPUT.PUT_LINE('alpha_square' || res);

    UPDATE my_table
      SET col_num0=res
    WHERE
        id=target_id;
    -- the parameter name `target_id` should be different than the column name `id`
END;

-- How to execute
exec update_to_alpha_square(target_id=>3, alpha=>9)
```
## Procedure (with output parameter)

```sql
-- With Output parameter

CREATE OR REPLACE PROCEDURE calc_alpha_square (alpha IN NUMBER, alpha_square OUT NUMBER)
IS
BEGIN
    alpha_square := alpha * alpha;
END;

-- How to execute

DECLARE
      output NUMBER; -- create variable
BEGIN
   calc_alpha_square(alpha=>7, alpha_square=>output);
   DBMS_OUTPUT.PUT_LINE(output);
END;

```

## Cursor
```sql
DECLARE
    weighted_sum NUMBER:=0;
    CURSOR my_cur IS SELECT * FROM my_table;
BEGIN
    FOR cur IN my_cur LOOP
        weighted_sum := weighted_sum + (cur.col_num0 * cur.col_num1);
    END LOOP;
    dbms_output.put_line( 'weighted_sum ' || weighted_sum);
END;
```

## Trigger

```sql
CREATE OR REPLACE TRIGGER my_trigger
BEFORE -- options: BEFORE | AFTER | INSTEAD OF
UPDATE -- options: INSERT [OR] | UPDATE [OR] | DELETE
-- optional: OF [column]
ON my_table
-- REFERENCING OLD AS old_values NEW AS new_values -- optional
FOR EACH ROW -- optional
--WHEN (id > 100) -- only if `FOR EACH ROW`
DECLARE
BEGIN
    dbms_output.put_line('Update my_table::col_char: ' || chr(10));
    dbms_output.put_line(chr(9)||'OLD.col_char: ' || :old.col_num0);
    dbms_output.put_line(chr(9)||'NEW.col_char: ' || :new.col_num0);
    :new.col_num0 := :new.col_num0 * 2;
    dbms_output.put_line(chr(9)||'final value: ' || :new.col_num0);
END;
-- chr(9) == '\t'
-- chr(10) == '\n'
```

---

# Index And Explain Plan ![icon](../../../assets/images/sql_explain_plan.png) (F10)

Create and populate a dummy table. In which we will evaluate the performance of the query

```sql
SELECT x2 FROM table_pow WHERE x = VALUE
```

```sql
CREATE TABLE table_pow(
    x NUMBER,
    x2 NUMBER
);


BEGIN
  FOR x IN 0..1000000
  LOOP
    INSERT INTO table_pow (x, x2)
    SELECT x, power(x, 2) FROM DUAL;
  END LOOP;
END;
```

<p float='left'>
<img  src="../../../assets/images/sql_explain_full.png" alt="image">
</p>

With index:

```sql
CREATE INDEX index_x ON table_pow(x);
```

<p float='left'>
<img  src="../../../assets/images/sql_explain_index.png" alt="image">
</p>

Note that with the index the option changed from "FULL" to "RANGE SCAN", and with that, the drop in cardinality and cost.

<p float='left'>
<img  src="../../../assets/images/sql_explain_index_unique.png" alt="image">
</p>

# Built-in Functions
Instead of create a list of elements with `SELECT * UNION ALL`. We could use the native functions of sys (`sys.odcinumberlist`, `sys.odcivarchar2list`, ...).

As an example, this procedure that adds the values ​​(number) of the list `my_number` only if the value of the same index of the list `my_chars` is equal to `U`.

```sql
CREATE OR REPLACE PROCEDURE sum_array_if_mychar_is_U(
    my_numbers IN sys.odcinumberlist,
    my_chars IN sys.odcivarchar2list,
    sum_out OUT NUMBER
)
IS
BEGIN
    sum_out := 0;
    FOR i IN 1..my_numbers.count LOOP
        IF my_chars(i) = 'U' THEN
            sum_out := sum_out + my_numbers(i);
        END IF;
    END LOOP;
END;
```
### call example

```sql
DECLARE
    my_numbers sys.odcinumberlist := sys.odcinumberlist(10, 20, 30, 40, 50);
    my_chars sys.odcivarchar2list := sys.odcivarchar2list('A', 'U', 'I', 'O', 'U');
    sum_out NUMBER;
BEGIN
    sum_array_if_mychar_is_U(my_numbers, my_chars, sum_out);
    dbms_output.put_line('Sum of my_numbers values where my_chars is "U": ' || sum_out);
    -- 70
END;
```
