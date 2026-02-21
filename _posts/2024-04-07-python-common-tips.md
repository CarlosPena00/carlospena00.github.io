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
uv init
uv add ipykernel jupyterlab npm node nodejs jupyterlab_execute_time black isort jupyterlab-code-formatter

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

## Pre-commit

```py
# .pre-commit-config.yaml
# See https://pre-commit.com for more information
# See https://pre-commit.com/hooks.html for more hooks
rerepos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v6.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-toml
      - id: check-added-large-files
      - id: mixed-line-ending
        args: [--fix=lf]
        exclude: '\.bat$'
      - id: check-merge-conflict
      - id: detect-private-key

  - repo: https://github.com/Lucas-C/pre-commit-hooks
    rev: v1.5.5
    hooks:
      - id: remove-tabs

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.14.14
    hooks:
      - id: ruff-check
        args: [--fix, --unsafe-fixes]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.18.2
    hooks:
      - id: mypy
        exclude: "^tests/"
```

- uv run pre-commit run --all-files

## Alias & Functions

```js
alias gf='git fetch -p'
alias gg='git push origin HEAD'
alias gadd='git diff --name-only --cached | xargs git add'
alias uruff='uv run ruff check --fix --unsafe-fixes'

killport() {
  if [ -z "$1" ]; then
    echo "Usage: killport <port>"
    return 1
  fi

  PORT="$1"
  PIDS=$(lsof -t -i tcp:"$PORT" -sTCP:LISTEN)

  if [ -z "$PIDS" ]; then
    echo "No process is listening on port $PORT"
    return 0
  fi

  echo "Killing processes on port $PORT: $PIDS"
  kill -9 $PIDS
}
```

## Make

- Source and instructions: https://github.com/giovannipcarvalho/micromamba.mk
