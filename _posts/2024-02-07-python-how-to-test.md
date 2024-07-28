---
layout: post
title: "Z-UnderDev Python: How to test your code"
author: Carlos Pena
date: 2022-11-12
---

## Task: Convert `string` to `int`
- If invalid string return None (maybe you should raise a exception)
- If a "float string" you should return the ceil

1. Define the function types/interface (do no implement yet)

```py
def custom_convert_str_to_int(my_str: str) -> int | None:
    _ = my_str
    return 0
```

2. Define your test

```py
def test_custom_convert_str_to_int_smoke_test():
    # happy path, "the function will not crash"
    assert custom_convert_str_to_int("1") == 1

def test_custom_convert_str_to_int_when_invalid_input():
    assert custom_convert_str_to_int("Alfa") is None
    assert custom_convert_str_to_int("O is not 0") is None
    assert custom_convert_str_to_int("3. 14") is None

def test_custom_convert_str_to_int_when_int_with_space():
    assert custom_convert_str_to_int(" 7    ") == 7

def test_custom_convert_str_to_int_when_float_string():
    assert custom_convert_str_to_int("3.14") == 4
```

3. Implement

```py
def custom_convert_str_to_int(my_str: str) -> int | None:
    try:
        converted_float = float(my_str)
        converted = math.ceil(converted_float)
    except ValueError:
        converted = None
    return converted
```

4. Run check/test
```py
mypy name_file.py
ruff name_file.py
pytest name_file.py
...
```

## Task 2: TODO

```py
from unittest.mock import patch
from unittest.mock import MagicMock
```
