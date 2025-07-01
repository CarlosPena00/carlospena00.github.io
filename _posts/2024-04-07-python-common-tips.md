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

## Alias & Functions

```js
alias ca='micromamba activate'
alias caa='micromamba activate `basename "$PWD"`'
alias cad='micromamba deactivate'
alias jlab='micromamba activate jupyterinstall && jupyter lab'
alias gf='git fetch -p'
alias gg='git push origin HEAD'
alias gadd='git diff --name-only --cached | xargs git add'
alias ruffc='ruff check --fix'

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

```makefile
# use current-folder's name as project name
PROJECT_NAME := $(notdir ${PWD})
MAMBA := micromamba
VENV := $$($(MAMBA) info | awk -F': ' '/base env/{print $$2}')/envs/$(PROJECT_NAME)
PYTHON := $(VENV)/bin/python
MARKER := .micromambaenv

.PHONY: all
all: env deps check test ## Run main targets

.PHONY: env
env: | $(MARKER) ## Create or update virtual environment

.PHONY: activate
activate: ## Open a new shell with the activated environment
    @unset MAKELEVEL && \
    echo 'eval "$$($(MAMBA) shell activate ${PROJECT_NAME})"; exec </dev/tty' | exec bash -i

.PHONY: deps
deps: env ## Sync dependencies in the virtual environment
    @CONDA_PREFIX=$(VENV) $(VENV)/bin/uv pip sync requirements-dev.txt
    @$(VENV)/bin/pre-commit install >/dev/null

.PHONY: lockdeps
lockdeps: env ## Update or generate dependency lock files
    @$(VENV)/bin/uv pip compile setup.cfg -o requirements.txt $(args)
    @for extra in $$($(PYTHON) -c \
        'from setuptools.config.setupcfg import read_configuration as c; \
        print(*c("setup.cfg")["options"]["extras_require"])'); do \
            $(VENV)/bin/uv pip compile setup.cfg \
            -o requirements-$$extra.txt --extra $$extra $(args); \
    done

.PHONY: check
check: env ## Run checkers, linters and auto-fixers
    @$(VENV)/bin/pre-commit run --all-files

.PHONY: test
test: env ## Run tests
    @$(PYTHON) -m pytest

.PHONY: cov
cov: env ## Run tests and report coverage
    @$(VENV)/bin/coverage erase
    @$(VENV)/bin/coverage run --source=. --branch -m pytest || true
    @$(VENV)/bin/coverage report --show-missing --skip-covered --include 'tests/*' --fail-under 100
    @$(VENV)/bin/coverage report --show-missing --skip-covered

.PHONY: build
build: ## Build artifacts
    @docker build . -t ${PROJECT_NAME}

.PHONY: run
run: ## Run main entrypoint
    @docker run --rm -it ${PROJECT_NAME}

.PHONY: clean
clean: ## Clean-up generated files
    @find -type f -name '*.pyc' -delete
    @find -type f -name '*mypyc*linux-gnu.so' -delete
    @find -type d -name '__pycache__' -delete
    @find -type d -name '.*_cache' -exec rm -rf {} +
    @rm -rf *.egg-info
    @rm -rf dist
    @rm -f .coverage

.PHONY: purge
purge: clean ## Clean-up and remove environment
    @$(MAMBA) env remove -y -n ${PROJECT_NAME} && rm -rf $(MARKER)

.PHONY: help
help: ## Show help
    @awk -F':.*##' '/##[[:space:]]/{printf "\033[1;32m%-12s\033[m%s\n", $$1, $$2}' ${MAKEFILE_LIST}

$(MARKER): environment.yml # only update when environment.yml changes
    @$(MAMBA) create -n ${PROJECT_NAME} -f $< -y
    @touch $@

.PHONY: _active
_active: # check that environment is active
ifneq ($(notdir ${CONDA_PREFIX}), $(PROJECT_NAME))
    $(error Run "$(MAMBA) activate $(PROJECT_NAME)" first)
endif

```
