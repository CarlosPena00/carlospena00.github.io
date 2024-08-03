---
layout: post
title: "Z-UnderDev DB: NoSQL ElasticSearch: TL;DR"
author: Carlos Pena
date: 2024-07-27
---

- TODO

# Install


## Elastic
```js
// ElasticSearch requires virtual memory at least [262144]
// it will be reseted to default value after reboot
sudo sysctl -w vm.max_map_count=262144
// Created a network to ensure communication between kibana and elastic
docker network create elastic
docker run --name es01 --net elastic -p 9200:9200 -it -m 6GB -e ELASTIC_PASSWORD=mypass docker.elastic.co/elasticsearch/elasticsearch:8.14.3
// Copy SL Certificate
docker cp es01:/usr/share/elasticsearch/config/certs/http_ca.crt .
```

## Kibana

```js
docker run --name kib01 --net elastic -p 5601:5601 docker.elastic.co/kibana/kibana:8.14.3


// How to get the elastic-kibana Token:
// A) On Elastic logs search for the enrollment token
// ℹ️  Configure Kibana to use this ie. eyJ2ZXIiOiI4LjE0LjAiLC...In0=
// B) or run
docker exec es01 bin/elasticsearch-create-enrollment-token --scope kibana
```

## Python lib
```js
pip install elasticsearch[async]
```

## How to connect

```py
# via Curl
curl --cacert http_ca.crt -u elastic:mypass https://localhost:9200

# via Python
es = Elasticsearch('https://localhost:9200', basic_auth=("elastic", "mypass"), ca_certs="http_ca.crt")
es.ping()
```

# Add data to an index

```py
# Dummy Data
from faker import Faker
fake = Faker()

documents = [
    {
        "name": fake.name(),
        "address": fake.address().replace("\n", ". "),
        "age": fake.numerify("##"),
        "email": fake.ascii_email(),
        "country": fake.country(),
        "postal_code": fake.postalcode(),
    } for _ in range(100_000)
]
"""
{
    "name": "Olivia Cortez",
    "address": "6997 Brown Dam Apt. 239. Chavezfurt, OH 85308",
    "age": "71",
    "email": "colemanjustin@yahoo.com",
    "country": "Afghanistan",
    "postal_code": "61032",
},
...
"""

# Slow Index
for i, doc in enumerate(tqdm(documents)):
    res = es.index(index="prod_es_index", id=i+1, body=doc)
# ~ 28min
```
## Bulk API
Performs multiple indexing or delete operations in a single API call. This reduces overhead and can greatly increase indexing speed.

```py
from elasticsearch.helpers import bulk, parallel_bulk
def generate_bulk_data(index="prod_es_bulk_index"):
    return (
        {
            "_op_type": "index",  # index, create, delete, update
            "_index": index,
            "_id": idx+1,
            **d,
        }
        for idx, d in enumerate(documents)
    )
# bulk Index
bulk(es, generate_bulk_data())
# ~8.28s

# Parallel_bulk index
for success, info in parallel_bulk(
    es,
    generate_bulk_data(index="prod_es_bulk_parallel_index"),
    chunk_size=10_000,
    thread_count=10
):
    pass
# ~2.29s
```

# Search

```py
query = {"query": {"match": {"age": "18"}}}

res = es.search(index="prod_es_bulk_parallel_index", body=query)
for hit in res["hits"]["hits"]:
    print(hit["_source"])

{'name': 'Lisa Shaw', 'address': '918 Victor Union. Millerhaven, TN 88530', 'age': '18', 'email': 'sadams@hotmail.com', 'country': 'Hong Kong', 'postal_code': '14096'}
{'name': 'Samuel Williams', 'address': '43330 Fowler Road Suite 239. Johnsonhaven, NC 10046', 'age': '18', 'email': 'david89@yahoo.com', 'country': 'Chad', 'postal_code': '73249'}
{'name': 'Kathleen Lee', 'address': '54362 Eddie Key. Perryport, AK 50151', 'age': '18', 'email': 'lwalsh@hotmail.com', 'country': 'Kyrgyz Republic', 'postal_code': '81990'}
{'name': 'David Scott', 'address': '44738 Harris Stream. Port Leroy, VA 29682', 'age': '18', 'email': 'howardcathy@joyce.biz', 'country': 'Svalbard & Jan Mayen Islands', 'postal_code': '77346'}
...
```

---

## TODO:

- Search
  - Filter
- Mappings
- Synonym
- Aggregation
- DSL lib
- Kibana
