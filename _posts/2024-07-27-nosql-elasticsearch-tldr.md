---
layout: post
title: "DB: NoSQL ElasticSearch: TL;DR"
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
# Index

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
```

```py
# Index Settings, in which we set the Analyzer, Synonym, and Mappings
index_settings = {
    "settings": {
        "analysis": {
            "filter": {
                "synonym_filter": {
                    "type": "synonym",
                    "synonyms": [
                        "Carlinhos => Carlos",  # Carlos Exists
                        "Hector => Heitor",  # Hector Exists
                        "Maria => Mary",  # Both Exists
                        "Ana, Anna",  # Both Exists
                    ],
                }
            },
            "analyzer": {
                "custom_analyzer": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "synonym_filter"],
                }
            },
        }
    },
    "mappings": {
        "properties": {
            "name": {"type": "text", "analyzer": "custom_analyzer"},
            "address": {"type": "text", "analyzer": "custom_analyzer"},
            "age": {"type": "integer"},
            "email": {"type": "text"},
            "country": {"type": "keyword"},
            "postal_code": {"type": "keyword"},
        }
    },
}
```
## Synonyms

## Analyzer

## Mappings

---


# Slow Index

```py
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
```
```py
# Anna over 30 yo
query = {
    "query": {
        "bool": {
            "must": [
                {"match": {"name": "Anna"}},
                {"range": {"age": {"gt": 30}}},
            ]
        }
    },
    "size": 10,
}

res = es.search(index=index_name, body=query)
for hit in res["hits"]["hits"]:
    print(hit["_source"]["name"], hit["_source"]["age"])

"""
Anna Scott 78
Anna Fitzgerald 84
Ana Lopez 85 # synonyms
Anna Campbell 76
...
"""
```
```py
# (Anna over 98 yo) or (Carlos aged 24)
query = {
    "query": {
        "bool": {
            "should": [
                {
                    "bool": {
                        "must": [
                            {"match": {"name": "Anna"}},
                            {"range": {"age": {"gt": 98}}}
                        ]
                    }
                },
                {
                    "bool": {
                        "must": [
                            {"match": {"name": "Carlos"}},
                            {"term": {"age": 24}}
                        ]
                    }
                }
            ],
            # At least one of the should conditions must match
            "minimum_should_match": 1
        }
    }
}

res = es.search(index=index_name, body=query)
for hit in res["hits"]["hits"]:
    source = hit["_source"]
    print(source["name"], source["age"])
"""
Ana Sutton 99
Anna Ruiz 99
Carlos Hardy 24
Carlos Turner 24
...
"""
```

# Aggregation

```py
query = {
    "query": {"match": {"name": "ANNA"}},
    "size": 2,
    "aggs": {"country": {"terms": {"field": "country"}}},
}

res = es.search(index=index_name, body=query)
for hit in res["hits"]["hits"]:
    print(hit["_source"])
pprint(res["aggregations"])

{'name': 'Anna Scott', 'address': '431 Aguilar Rue. Jenniferfort, MS 98932', 'age': '78', 'email': 'vrobinson@bailey.com', 'country': 'Georgia', 'postal_code': '55696'}
{'name': 'Anna Miller', 'address': 'Unit 4447 Box 6636. DPO AA 84024', 'age': '09', 'email': 'dawsonsophia@gmail.com', 'country': 'Switzerland', 'postal_code': '95838'}
# Although only two results are returned by the "size" parameter, the aggregaton considers all results that match the query.
{'country': {'buckets': [{'doc_count': 5, 'key': 'British Virgin Islands'},
                         {'doc_count': 5, 'key': 'Moldova'},
                         {'doc_count': 4, 'key': 'Congo'},
                         {'doc_count': 4, 'key': 'Czech Republic'},
                         {'doc_count': 4, 'key': 'Guatemala'},
                         {'doc_count': 4, 'key': 'Kiribati'},
                         {'doc_count': 4, 'key': 'Mauritania'},
                         {'doc_count': 4, 'key': 'Netherlands'},
                         {'doc_count': 4, 'key': 'Peru'},
                         {'doc_count': 4, 'key': 'Saint Helena'}],
             'doc_count_error_upper_bound': 0,
             'sum_other_doc_count': 245}}
# Remember: Text fields are not optimised for operations that require per-document field data like aggregations and sorting
# In this index "country" are "keyword" type

# Remember: By default, the requests cache will only cache the results of search requests where size=0,
# so it will not cache hits, but it will cache hits.total, aggregations, and suggestions.

```

---

## TODO:

```js
User Cases
Install (kibana/Elastic) // OK
Index:
- Add data / bulk API // OK
- Synonym
- Types/Mappings (invert index, ...)
- Token
- Analyzers
Search:
- How to build query
- Aggregation
- Filter
- Analyze query
DSL lib
Kibana
```
