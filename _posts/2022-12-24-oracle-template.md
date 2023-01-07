---
layout: post
title: "SQL Oracle: Template (Under Dev)"
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
Create, Drop, Alter ...
## Create Table

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

```
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
```SQL
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

```SQL
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

# DQL – Data Query Language
Select

# DML – Data Manipulation Language
Insert, Update, Delete, ...

# TCL – Transaction Control Language
Commit, rollback
