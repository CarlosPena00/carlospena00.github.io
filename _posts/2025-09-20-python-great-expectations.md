---
layout: post
title: "Python: Great Expectations - NoQA"
author: Carlos Pena
date: 2025-07-20
---

NoQA: I’m experimenting with some data quality frameworks to build my quality gate. Following the recommendation from DeepLearning.AI’s Data Engineering course, I started with Great Expectations.

That said, I don’t feel I’ve had the best experience so far, and for now, I think it’s better to explore another framework (this time I tested v1.6.2).

I just want to save the code for reference, I won’t go into details or explanations here :(.

## From SQL

```py
import great_expectations as gx
import pandas as pd
from sqlalchemy import create_engine

df = pd.read_csv("https://raw.githubusercontent.com/great-expectations/gx_tutorials/main/data/yellow_tripdata_sample_2019-01.csv")

df["passenger_count"].value_counts(dropna=False)
# passenger_count
# 1    7299
# 2    1458
# 5     415
# 3     390
# 6     252
# 4     186
# Name: count, dtype: int64

expectation = gx.expectations.ExpectColumnValuesToBeBetween(
    column="passenger_count", min_value=1, max_value=4
)
validation_result = batch.validate(expectation)
print(validation_result)
```

```json
{
  "success": false,
  "expectation_config": {
    "type": "expect_column_values_to_be_between",
    "kwargs": {
      "batch_id": "tripdata-tripdata_asset",
      "column": "passenger_count",
      "min_value": 1.0,
      "max_value": 4.0
    },
    "meta": {},
    "severity": "critical"
  },
  "result": {
    "element_count": 10000,
    "unexpected_count": 667,
    "unexpected_percent": 6.67,
    "partial_unexpected_list": [5, ..., 5],
    "missing_count": 0,
    "missing_percent": 0.0,
    "unexpected_percent_total": 6.67,
    "unexpected_percent_nonmissing": 6.67,
    "partial_unexpected_counts": [
      {
        "value": 5,
        "count": 20
      }
    ],
    "partial_unexpected_index_list": [9333,..., 9352]
  },
  "meta": {},
  "exception_info": {
    "raised_exception": false,
    "exception_traceback": null,
    "exception_message": null
  }
}
```

## Via DB

> docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pass -v pgdata:/data/postgres -v user_data:/user_data docker.io/postgres

```py
conn_str = r"postgresql+psycopg://postgres:pass@localhost:5432/postgres" # real string should be in .env file
engine = create_engine(conn_str)


df = pd.read_csv("https://raw.githubusercontent.com/great-expectations/gx_tutorials/main/data/yellow_tripdata_sample_2019-01.csv")
df.to_sql("tripdata", engine, index=False, if_exists="replace")

data_source = context.data_sources.add_postgres(
    "postgres db", connection_string=conn_str
)

data_asset = data_source.add_table_asset(name="taxi data", table_name="tripdata")
batch_definition = data_asset.add_batch_definition_whole_table("batch definition")
batch = batch_definition.get_batch()

suite = context.suites.add(
    gx.core.expectation_suite.ExpectationSuite(name="expectations")
)
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeBetween(
        column="passenger_count", min_value=1, max_value=6
    )
)
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToBeBetween(column="fare_amount", min_value=0)
)

validation_definition = context.validation_definitions.add(
    gx.core.validation_definition.ValidationDefinition(
        name="validation definition",
        data=batch_definition,
        suite=suite,
    )
)

checkpoint = context.checkpoints.add(
    gx.checkpoint.checkpoint.Checkpoint(
        name="checkpoint", validation_definitions=[validation_definition]
    )
)

checkpoint_result = checkpoint.run()
print(checkpoint_result.describe())
```

```json
{
    "success": false,
    "statistics": {
        "evaluated_validations": 1,
        "success_percent": 0.0,
        "successful_validations": 0,
        "unsuccessful_validations": 1
    },
    "validation_results": [
        {
            "success": false,
            "statistics": {
                "evaluated_expectations": 2,
                "successful_expectations": 1,
                "unsuccessful_expectations": 1,
                "success_percent": 50.0
            },
            "expectations": [
                {
                    "expectation_type": "expect_column_values_to_be_between",
                    "success": true,
                    "kwargs": {
                        "batch_id": "postgres db-taxi data",
                        "column": "passenger_count",
                        "min_value": 1.0,
                        "max_value": 6.0
                    },
                    "result": {
                        "element_count": 10000,
                        "unexpected_count": 0,
                        "unexpected_percent": 0.0,
                        "partial_unexpected_list": [],
                        "missing_count": 0,
                        "missing_percent": 0.0,
                        "unexpected_percent_total": 0.0,
                        "unexpected_percent_nonmissing": 0.0,
                        "partial_unexpected_counts": []
                    }
                },
                {
                    "expectation_type": "expect_column_values_to_be_between",
                    "success": false,
                    "kwargs": {
                        "batch_id": "postgres db-taxi data",
                        "column": "fare_amount",
                        "min_value": 0.0
                    },
                    "result": {
                        "element_count": 10000,
                        "unexpected_count": 7,
                        "unexpected_percent": 0.06999999999999999,
                        "partial_unexpected_list": [
                            -0.01,
                            -52.0,
                            -0.1,
                            -5.5,
                            -3.0,
                            -52.0,
                            -4.0
                        ],
                        "missing_count": 0,
                        "missing_percent": 0.0,
                        "unexpected_percent_total": 0.06999999999999999,
                        "unexpected_percent_nonmissing": 0.06999999999999999,
                        "partial_unexpected_counts": [
                            {
                                "value": -52.0,
                                "count": 2
                            },...
                            {
                                "value": -0.01,
                                "count": 1
                            }
                        ]
                    }
                }
            ],
            "result_url": null
        }
    ]
}
```

```py
# Check UI (need to be update after each .run)
print(context.build_data_docs())
context.open_data_docs()
```

```sql
delete from tripdata
where fare_amount < 0
```

```py
checkpoint_result = checkpoint.run()
print(checkpoint_result.describe())
```

```json
{
    "success": true,
    "statistics": {
        "evaluated_validations": 1,
        "success_percent": 100.0,
        "successful_validations": 1,
        "unsuccessful_validations": 0
    },
    "validation_results": [
        {
            "success": true,
            "statistics": {
                "evaluated_expectations": 2,
                "successful_expectations": 2,
                "unsuccessful_expectations": 0,
                "success_percent": 100.0
            },
            "expectations": [
                {
                    "expectation_type": "expect_column_values_to_be_between",
                    "success": true,
                    "kwargs": {
                        "batch_id": "postgres db-taxi data",
                        "column": "passenger_count",
                        "min_value": 1.0,
                        "max_value": 6.0
                    },
                    "result": {
                        "element_count": 9993,
                        "unexpected_count": 0,
                        "unexpected_percent": 0.0,
                        "partial_unexpected_list": [],
                        "missing_count": 0,
                        "missing_percent": 0.0,
                        "unexpected_percent_total": 0.0,
                        "unexpected_percent_nonmissing": 0.0,
                        "partial_unexpected_counts": []
                    }
                },
                {
                    "expectation_type": "expect_column_values_to_be_between",
                    "success": true,
                    "kwargs": {
                        "batch_id": "postgres db-taxi data",
                        "column": "fare_amount",
                        "min_value": 0.0
                    },
                    "result": {
                        "element_count": 9993,
                        "unexpected_count": 0,
                        "unexpected_percent": 0.0,
                        "partial_unexpected_list": [],
                        "missing_count": 0,
                        "missing_percent": 0.0,
                        "unexpected_percent_total": 0.0,
                        "unexpected_percent_nonmissing": 0.0,
                        "partial_unexpected_counts": []
                    }
                }
            ],
            "result_url": null
        }
    ]
}
```
