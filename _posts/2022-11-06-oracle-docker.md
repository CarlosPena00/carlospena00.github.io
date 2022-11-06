---
layout: post
title: Install Oracle Express with Docker
author: Carlos Pena
date: 2022-11-06
---

# Oracle SQL

Start a Oracle Express DB with [docker](https://docs.docker.com/engine/install/ubuntu/)
```sql
$ docker run -d -p 1521:1521 -e ORACLE_PASSWORD=<PASS> \
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

## Create a sample function (sleep)

```sql
CREATE OR REPLACE FUNCTION sleep (sec IN NUMBER) RETURN NUMBER
AS
BEGIN
    DBMS_SESSION.SLEEP(sec);
    return sec;
END;

-- example:
select sleep(2) from dual;
```
