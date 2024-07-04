---
layout: post
title: "SQLNo MongoDB: TL;DR"
author: Carlos Pena
date: 2024-07-04
---

- Motto: Data that is accessed together should be stored together

# SQL vs NoSQL

```py
| RDBMS  | MongoDB                    |
| ------ | -------------------------- |
| Table  | Collection                 |
| Row    | Document                   |
| Column | Field                      |
| Join   | Embedding/Linking($Lookup) |
```

- [Convert SQL to MongoDB](https://statichosting-yiymv.mongodbstitch.com/createtable.html)

---

# Docker

```js
docker pull mongodb/mongodb-community-server:latest
docker run -p 27017:27017 -d mongodb/mongodb-community-server:latest [--replSet myReplicaSet]
```

# [MongoSH](https://www.mongodb.com/try/download/shell)

> mongosh --port 27017

```js
use mydatabase
db.createCollection("mycollection")
db.mycollection.insertOne({ name: "Carlos Pena", age: 28, occupation: "Engineer" })
db.mycollection.insertMany([
    { name: "Alfa", age: 25, occupation: "Designer" },
    { name: "Bravo", age: 30, occupation: "Manager" }
])
db.mycollection.find({ name: "Carlos Pena" }).pretty()
```

- [MongoDB Compass Download (GUI)](https://www.mongodb.com/try/download/compass)

---

# PyMongo

```py
import random
import pymongo
from pymongo import MongoClient

client = MongoClient("localhost", 27017) # docker default
db = client["my_database"]
```

## Create/Drop Table

```py
collection = db["my_table"] # table -> collection
db.drop_collection("my_table")
```

## Insert

```py
collection.insert_one({"name": "Carlos Pena", "age": 28, "occupation": "Engineer"})
collection.insert_many(
    [
        {"name": f"A {idx}", "age": random.randint(0, 10_000), "occupation": "Designer"}
        for idx in range(1_000_000)
    ]
)
```

## Update/Replace
```py
collection.insert_one({"name": "Carlos Pena", "age": 28, "occupation": "Engineer"})
collection.update_one(
    {"name": "Carlos Pena"}, {"$set": {"age": 99, "occupation": "Data Engineer"}}
)
collection.update_many(
    {"name": "Carlos Pena"}, {"$set": {"age": 99, "occupation": "Data Engineer"}}
)
collection.replace_one(
    {"name": "Carlos Pena"}, {"name": "Carlos Pena Doe", "age": 0, "occupation": "Engineer"}
)
```

## Delete
```py
collection.delete_one({"name": "Carlos Pena"})  # Check output n
# DeleteResult({'n': 1, 'ok': 1.0}, acknowledged=True) ## Done
# DeleteResult({'n': 0, 'ok': 1.0}, acknowledged=True) ## Not found
collection.delete_many({"name": "Carlos Pena"})
collection.delete_many({"age": {"$lt": 18}})
```

## Query

```py
for doc in collection.find({"name": "Carlos Pena"}):
    print(doc)

for doc in collection.find({"age": {"$lt": 2}}):
    print(doc)
```

## Index

```py
collection.create_index({"age": pymongo.ASCENDING}) # returns index name
# Index Types: pymongo.ASCENDING, pymongo.DESCENDING, pymongo.GEO2D, pymongo.GEOSPHERE
#              pymongo.HASHED, pymongo.TEXT
# Main parameters:
# - `unique`: if ``True``, creates a uniqueness constraint on the index.
# - `background`: if ``True``, this index should be created in the background.

collection.drop_index("age_1")

# Perf: %%timeit
for _ in collection.find({"age": {"$eq": 10_000}}):
    pass
# WO Index: 260 ms ± 01.3 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
# W  Index: 232 μs ± 14.6 μs per loop (mean ± std. dev. of 7 runs, 1,000 loops each)
```
# Text Search

```py
# Setup
import random
import string

import pymongo
from pymongo import MongoClient

# Data
client = MongoClient("localhost", 27017)
db = client["mydatabase"]
collection = db["text_search_collection"]
collection.insert_many(
    [
        {
            "first_name": "".join(random.sample(string.ascii_letters, k=10)),
            "last_name": "".join(random.sample(string.ascii_letters, k=10)),
            "age": random.randint(0, 100),
        }
        for _ in range(1_000_000)
    ]
)
```
## Text Index

```py
collection.create_index({"first_name": pymongo.TEXT})
# Text search only works using the $text query operator.
# Warning: One Text Index Per Collection

for doc in collection.find({"first_name": {"$regex": "^AabB.*"}}):  # or "^AabB"
    print(doc)
# Wo Index: 442 ms ± 6.41 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
# W  Index: 294 μs ± 29.9 μs per loop (mean ± std. dev. of 7 runs, 1,000 loops each)


for doc in collection.find({"first_name": {"$regex": ".*AabB.*"}}):  # or "AabB"
    print(doc)
# W/Wo Index: 442 ms ± 6.41 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
# Cannot use index if prefix is unknown

# Regex case insensitive
collection.create_index({"first_name": pymongo.ASCENDING, "strength": 2})
# Case-insensitive indexes typically *do not* improve performance for $regex queries
for doc in collection.find({"first_name": {"$regex": "^AabB", "$options": "i"}}):
    print(doc)
# Wo Index: 433 ms ± 8.69 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)

for doc in collection.find({"first_name": "bgGDTVwJnm"}):
    print(doc)
# collection.create_index({"first_name": pymongo.TEXT})
# Wo Index: 289 ms ± 1.6 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
# W  Index: 290 ms ± 2.3 ms per loop (mean ± std. dev. of 7 runs, 1 loop each)
# index not used as it is not a $regex; we need to create another index
collection.create_index({"first_name": pymongo.ASCENDING})
# W  Index: 269 μs ± 58.3 μs per loop (mean ± std. dev. of 7 runs, 1,000 loops each)
```

## Text Index with multiple fields

```py
collection.create_index({"first_name": pymongo.TEXT, "last_name": pymongo.TEXT})
# Text search only works using the $text query operator.
# Warning: One Text Index Per Collection
collection.insert_many(
    [
        {
            "first_name": "Carlos Henrique",
            "last_name": "Pena, Carlos",
            "age": 28,
        },
        {
            "first_name": "Carlos Henrique",
            "last_name": "Caloete Pena",
            "age": 28,
        },
        {
            "first_name": "Henrique",
            "last_name": "Pena, Carlos",
            "age": 28,
        },
    ]
)
for doc in collection.find({"$text": {"$search": "Carlos"}}):
    print(doc)
# 323 μs ± 63.8 μs per loop (mean ± std. dev. of 7 runs, 1,000 loops each)
# Matches the three doc
```

# Embedding vs Referencing
