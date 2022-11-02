---
layout: post
title: Python Auto Formatter and Pre-commit
author: Carlos Pena
date: 2019-01-28
---

# Summary

```py
$ conda install -c conda-forge pip pre-commit flake8 black -y
```


# Flake8 and Black
```py
conda install -c conda-forge flake8 -y
conda install -c conda-forge black -y
```

## A Good Sample
```py
# From
arr = [1,3,4 ,2]
# To
arr = [1, 3, 4, 2]
```

## Maybe Undesired ?
```py
# From
array = [ 0,  1,  2,  3,  4,  5,  6,  7,  8,  9,
         10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
         20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
         30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
         40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
         50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
         60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
         70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
         80, 81, 82, 83, 84, 85, 86, 87, 88, 89,
         90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
# To
array = [
    0,
    1,
    2,
    3,
    ...
    99,
]
```

## Disable it
```py
# fmt: off
array = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
        10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
        30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
        40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
        50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
        60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
        70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
        80, 81, 82, 83, 84, 85, 86, 87, 88, 89,
        90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
# fmt: on
```

# [Pre-commit](https://pre-commit.com/#install)
- [Hooks](https://pre-commit.com/hooks.html)

```sh
conda install -c conda-forge pre-commit -y
```
create a file `.pre-commit-config.yaml`

```yaml
repos:
-   repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v2.3.0
    hooks:
    -   id: check-yaml
    -   id: end-of-file-fixer
    -   id: trailing-whitespace
-   repo: https://github.com/psf/black
    rev: 21.12b0
    hooks:
    -   id: black
```

```py
$ pre-commit install
$ git add .
$ git commit -m "."
```

<img src="../../../assets/images/precommit.jpg" alt="image" width="100%">
