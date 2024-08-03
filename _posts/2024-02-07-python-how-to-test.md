---
layout: post
title: "Python: How to test your code"
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
# or pre-commit run --all-files
pytest name_file.py
...
```

## Task 2: Calculate total price with tax

Sometimes, due to N factors, the function has parts that we don't control/can't reproduce. For example, an external IO request, or some calculation that involves randomness.
Also, due to the current code architecture, testing in a "traditional" way would be very complicated.
In these cases we can use unittest.mock to patch the functions and mock the inputs.

- In this example we will assume that the tax will be dynamic, where this value will come from an IO call (sql call)

> total_price_with_tax = (price_un * (1 + federal_tax + state_tax)) * quantity


```py
from pytest import approx
from unittest.mock import patch
from unittest.mock import Mock


def sql(query) -> None | float:
    _ = query
    return None


def _select_federal_tax(product_id: int) -> float:
    federal_data = sql(f"select federal_tax from federal_table where id = {product_id}")
    federal_tax = federal_data[0]
    return federal_tax


def _select_state_tax(product_id: int) -> float:
    state_data = sql(f"select state_tax from state_table where id = {product_id}")
    state_tax = state_data[0]
    return state_tax


def calc_total_price_with_tax(product_id: int, quantity: int, price_un: float) -> float:
    federal_tax = _select_federal_tax(product_id=product_id)
    state_tax = _select_state_tax(product_id=product_id)
    tax_per_unit = (price_un * federal_tax) + (price_un * state_tax)
    total_price_with_tax = (price_un + tax_per_unit) * quantity
    return total_price_with_tax


def test_calc_total_price_with_tax_when_quantity_is_zero():
    with (
        patch("pricing._select_federal_tax") as mock_federal_tax,
        patch("pricing._select_state_tax") as mock_state_tax,
    ):
        mock_federal_tax.return_value = 0.05
        mock_state_tax.return_value = 0.10
        total_price = calc_total_price_with_tax(
            product_id=Mock(), quantity=0, price_un=100
        )
        assert total_price == 0.0


def test_calc_total_price_with_tax_proporcional_to_quantity():
    with (
        patch("pricing._select_federal_tax") as mock_federal_tax,
        patch("pricing._select_state_tax") as mock_state_tax,
    ):
        mock_federal_tax.return_value = 0.10
        mock_state_tax.return_value = 0.10
        total_price = calc_total_price_with_tax(
            product_id=Mock(), quantity=1, price_un=100
        )
        assert total_price == 120
        total_price = calc_total_price_with_tax(
            product_id=Mock(), quantity=10, price_un=100
        )
        assert total_price == 10 * 120


def test_calc_total_price_with_tax_with_zero_tax_is_price_times_quantity():
    with (
        patch("pricing._select_federal_tax") as mock_federal_tax,
        patch("pricing._select_state_tax") as mock_state_tax,
    ):
        mock_federal_tax.return_value = 0.0
        mock_state_tax.return_value = 0.0
        total_price = calc_total_price_with_tax(
            product_id=Mock(), quantity=3, price_un=100
        )
        assert total_price == 3 * 100


def test_calc_total_price_with_tax_is_equal_to_the_given_formula():
    price_un = 100
    federal_tax = 0.1
    state_tax = 0.05
    quantity = 2
    formula_total_price_with_tax = (price_un * (1 + federal_tax + state_tax)) * quantity

    with (
        patch("pricing._select_federal_tax") as mock_federal_tax,
        patch("pricing._select_state_tax") as mock_state_tax,
    ):
        mock_federal_tax.return_value = federal_tax
        mock_state_tax.return_value = state_tax
        total_price = calc_total_price_with_tax(
            product_id=Mock(), quantity=quantity, price_un=price_un
        )
        # Due to float approximation error, it is sometimes necessary to use an 'approx'.
        assert total_price == approx(formula_total_price_with_tax, abs=0.001)

# ... There are several other tests that can be done for this flow
```

Errors can still occur if sql returns an invalid value e.g.: grater than 1, NULL value or even or database connection issues. There must be validations of all external data of the application. As well as displaying an error message, if it is not possible to recover.

Remember, Tests must be part of the system architecture, a change in requirements cannot be "impossible/infeasible" due to tests.
