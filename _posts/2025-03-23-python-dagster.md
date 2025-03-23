---
layout: post
title: "Python: Cron/orchestration with Dagster"
author: Carlos Pena
date: 2025-03-23
---

- TODO! Underdev

Dagster is an open-source Python orchestration framework for building and managing data pipelines. It helps teams develop, schedule, and monitor workflows with strong observability, modular design, and support for modern data tools. Ideal for ETL, ML, and analytics workflows, Dagster ensures scalable and reliable data operations.

## Assets

```py
import os
from typing import Any

import pandas as pd
import requests
from dagster import AssetExecutionContext
from dagster import asset

import src
from src.resources.resources import PostgresResource

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(src.__file__), ".."))


with open(f"{PROJECT_ROOT}/sql/dummy.sql") as f:
    DUMMY_QUERY = f.read()


@asset(compute_kind="sql")
def dummy_data(
    context: AssetExecutionContext, postgres: PostgresResource
) -> pd.DataFrame:
    data, cols = postgres.sql(DUMMY_QUERY)
    dummy = pd.DataFrame(data, columns=cols)
    context.add_output_metadata({"Dummy return": len(dummy)})
    return dummy


@asset(compute_kind="io")
def dummy_io(
    context: AssetExecutionContext,
    dummy_data: pd.DataFrame,
) -> dict[str, Any]:
    context.add_output_metadata({"dummy": len(dummy_data)})
    if len(dummy_data) == 0:
        return {}

    r = requests.get("https://google.com")
    output = {"io": r.status_code, "db": dummy_data.to_dict(orient="records")}
    context.add_output_metadata({"result": output})
    return output
```

## Schedule

```py
from dagster import MAX_RUNTIME_SECONDS_TAG
from dagster import ScheduleDefinition
from dagster import define_asset_job

from src.assets.dummy_asset import dummy_data
from src.assets.dummy_asset import dummy_io

dummy_schedule = ScheduleDefinition(
    job=define_asset_job(
        name="dummy_job",
        selection=[
            dummy_io,
            dummy_data,
        ],
        tags={MAX_RUNTIME_SECONDS_TAG: 4 * 60},
    ),
    cron_schedule="*/10 * * * *",
    execution_timezone="America/Recife",
)
```

## Resources

```py
from typing import Any

from dagster import ConfigurableResource
from dagster import InitResourceContext
from psycopg_pool import ConnectionPool
from pydantic import PrivateAttr


class PostgresResource(ConfigurableResource):  # typing: ignore
    """Resource to communicate with postgres db."""

    pg_conn: str
    _pool: ConnectionPool = PrivateAttr()

    def setup_for_execution(self, context: InitResourceContext) -> None:  # noqa: ARG002
        self._pool = ConnectionPool(self.pg_conn, min_size=1, max_size=5, open=True)

    def teardown_after_execution(
        self,
        context: InitResourceContext,  # noqa: ARG002
    ) -> None:
        self._pool.close()

    def sql(self, query: str) -> tuple[Any, list[str]]:
        with self._pool.connection() as conn:
            with conn.cursor() as cursor:
                data = cursor.execute(query).fetchall()
                col_names = [col[0] for col in cursor.description]
                return data, col_names

```

## Definitions

```py
from typing import Any

from dagster import Definitions
from dagster import EnvVar
from dagster import load_assets_from_package_module

from src import assets
from src.resources.resources import PostgresResource
from src.schedules import dummy_schedule

base_resources: dict[str, Any] = {
    "postgres": PostgresResource(
        pg_conn=EnvVar("PG_CONN"),  # postgres://postgres:pass@localhost:5432/postgres
    )
}

defs = Definitions(
    assets=load_assets_from_package_module(assets),
    resources=base_resources,
    schedules=[dummy_schedule],
)
```

## Run it Script (DEV mode)

```js
TMP_DAGSTER_HOME=$PWD/dagster_home/default

mkdir -p $TMP_DAGSTER_HOME
cp dagster.yaml $TMP_DAGSTER_HOME/dagster.yaml

DAGSTER_HOME=$TMP_DAGSTER_HOME DASGTER_STORAGE=$TMP_DAGSTER_HOME/storage dagster dev -m src
```
