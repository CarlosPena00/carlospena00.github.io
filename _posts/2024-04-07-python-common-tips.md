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

## Ruff

```py
# ruff.toml
force-exclude = true
extend-exclude = ["*.ipynb"]

[lint]
select = [
  "E", # pycodestyle
  "W", # pycodestyle
  "F", # pyflakes
  "C90", # mccabe
  "I", # isort
  "UP", # pyupgrade
  "N", # pep8-naming
  "B", # flake8-bugbear
  "C4", # flake8-comprehensions
  "PT", # flake8-pytest-style
  "ARG", # flake8-unused-arguments
  "PD", # pandas-vet
  "RUF" # ruff
]
fixable = ["I", "UP", "C4"]

[lint.isort]
force-single-line = true

[lint.per-file-ignores]
"tests*" = ["ARG"]

[lint.flake8-bugbear]
extend-immutable-calls = ["fastapi.Depends", "fastapi.Query"]
```

- Tip: echo "alias ruffc='ruff check --fix'" >> .bashrc

## Pre-commit

```py
# .pre-commit-config.yaml
# See https://pre-commit.com for more information
# See https://pre-commit.com/hooks.html for more hooks
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: 'v5.0.0'
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
      - id: mixed-line-ending
        args: [--fix=lf]
        exclude: '\.bat$'
  - repo: https://github.com/Lucas-C/pre-commit-hooks
    rev: v1.5.5
    hooks:
      - id: remove-tabs
  - repo: https://github.com/charliermarsh/ruff-pre-commit
    rev: 'v0.8.4'
    hooks:
      - id: ruff
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: 'v1.13.0'
    hooks:
      - id: mypy
        additional_dependencies:
          [
            types-pytz,
            types-requests,
            types-cachetools,
            boto3-stubs,
            types-boto3-lite
          ]
```

- pre-commit run --all-files
