---
layout: post
title: "Python: Why I migrate from Pandas to Polars"
author: Carlos Pena
date: 2024-04-06
---

This is, in fact, the first "blog post", and I want to talk a bit about it. I developed a data-intensive application that should handle multiple users per second and work nonstop for 24h/7.

My first step was to convert all SQL queries into Pandas DataFrame, it was perfect to study the data and do some previews in a jupyter notebook. But, In production, the result was not satisfactory at all, even after Pandas 2.0, the code was slow, and we detected a memory leak about 1GB per day.

The leak was not something to worry about. We have a lot of extra RAM and set a restart policy in each pod after allocating too much RAM. Nevertheless, it was not something that I desired; after all, we should not worry about leaks in Python, right?
 

About the performance lets view some example:

```py
# Setup
import string

import numpy as np
import pandas as pd
import polars as pl
from polars.type_aliases import SchemaDefinition

# version:
Polars='0.20.18'
Pandas='2.2.1' # numpy backend

# Dummy Data:
columns = ["id", "name", "age", "is_active"]

def random_name() -> str:
    return "".join(np.random.choice([a for a in string.ascii_letters], size=10))


def create_sample_dataset(n_rows: int = 1_000_000):
    return [
        (
            np.random.randint(low=100000, high=999999, size=1),
            random_name(),
            np.random.randint(100),
            np.random.random() > 0.5,
        )
        for _ in range(n_rows)
    ]
```

```py
# Same dataset
data = create_sample_dataset(n_rows=1_000_000)

%%timeit
df_pd = pd.DataFrame(data, columns=columns)
# 201 ms ± 910 µs per loop (mean ± std. dev. of 7 runs, 1 loop each)

%%timeit
df_pl = pl.DataFrame(data, columns)
# 309 ms ± 2.55 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

```py
# each interaction a new dataset
%%timeit
data = create_sample_dataset(100_000)
df_pd = pd.DataFrame(data, columns=columns)
# 2.57 s ± 81.6 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)

%%timeit
data = create_sample_dataset(100_000)
df_pl = pl.DataFrame(data, columns)
# 2.41 s ± 58.4 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
```

- Filter data: Lets say that I want all "old" active users names that are above 18

```py
%%timeit
df_pd[
    (df_pd["age"] > 18) &
    (df_pd["is_active"]) &
    (df_pd["id"] < 500000)
]
# 748 ms ± 4.03 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)

%%timeit
df_pl.filter(
    (pl.col("age") > 18) &
    (pl.col("is_active")) &
    (pl.col("id") < 500000)
)
# 1.6 ms ± 32.2 µs per loop (mean ± std. dev. of 7 runs, 1,000 loops each)
```

### Conclusion

I really prefer the Pandas API, it is easy, intuitive and works well with Jupyter, however, Polars it faster, let's not take this Data Science habit into production environments. Too much dramatic? yes, you may just use Pandas with PyArrow implementation.

Anyways, Due to my limited available time I was unable to reproduce the memory leak. (I may update this).
