---
layout: post
title: "Python: Common tips"
author: Carlos Pena
date: 2024-04-06
---

## Fix: Python slower in Docker

The seccomp add a significant overhead, add `-security-opt seccomp=unconfined` into docker.

```py
version: '3'

services:
  worker:
    build: .
    security_opt:
      - seccomp:unconfined
    ports:
      - "8000:8000"

```

## chore: Jupyter recommend extensions


```py
pip install ipykernel jupyterlab npm node nodejs jupyterlab_execute_time black isort jupyterlab-code-formatter

ipython kernel install --user --name=<env_name>
```
