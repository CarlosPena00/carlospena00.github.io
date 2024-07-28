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
