"""General-purpose utility helpers (SDD.md §9.2).

Provides formatters, converters, and small utility functions used
across modules.  Functions here have no external dependencies beyond
the Python standard library.

Planned functions (Phase 2+):
    - ``build_line_billing_preview()`` — LINE message text builder
    - ``format_contract_period()`` — Date range to human-readable
    - ``generate_invoice_number()`` — Sequential invoice code

References:
    - SDD.md §9.2: shared/utils.py specification
    - SDD.md §9.1: Code organisation
"""

import re
from datetime import date, datetime
from typing import Any


def format_currency_th(amount: float | int, include_baht_suffix: bool = True) -> str:
    """Format a number as Thai currency with thousand separators.

    Examples
    --------
    >>> format_currency_th(1234567.50)
    "1,234,567.50"
    >>> format_currency_th(50000, include_baht_suffix=True)
    "50,000.00 บาท"

    Parameters
    ----------
    amount
        The numeric amount to format.
    include_baht_suffix
        If ``True``, appends ``" บาท"`` (Thai for Baht).

    Returns
    -------
    str
        Formatted currency string.
    """
    formatted = f"{float(amount):,.2f}"
    if include_baht_suffix:
        return f"{formatted} บาท"
    return formatted


def parse_thai_date(date_str: str) -> date:
    """Parse a Thai-format date string into a ``date`` object.

    Accepts formats:
        ``"31/12/2567"`` (DD/MM/YYYY — Buddhist Era year)
        ``"2026-12-31"`` (ISO — Gregorian year)
        ``"31 ธ.ค. 2567"`` (Thai month name)

    Parameters
    ----------
    date_str
        Date string in one of the accepted formats.

    Returns
    -------
    date
        Parsed ``date`` object (always Gregorian).

    Raises
    ------
    ValueError
        If the string cannot be parsed.
    """
    # Gregorian ISO format
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return datetime.strptime(date_str, "%Y-%m-%d").date()

    # Buddhist-Era DD/MM/YYYY  (B.E. = Gregorian + 543)
    if re.match(r"^\d{2}/\d{2}/\d{4}$", date_str):
        day, month, year_be = date_str.split("/")
        gregorian_year = int(year_be) - 543
        return date(gregorian_year, int(month), int(day))

    raise ValueError(f"Unrecognised date format: {date_str}")


def generate_invoice_number(
    prefix: str,
    year: int,
    month: int,
    sequence: int,
) -> str:
    """Generate a human-readable invoice number.

    Format: ``<prefix>-<YYYYMM>-<NNNN>``

    Parameters
    ----------
    prefix
        Property or building code (e.g. ``"INV"``).
    year
        Billing year (Gregorian).
    month
        Billing month (1-12).
    sequence
        Sequential number within the month.

    Returns
    -------
    str
        Formatted invoice number, e.g. ``"INV-202605-0001"``.
    """
    return f"{prefix}-{year:04d}{month:02d}-{sequence:04d}"


def truncate_string(value: str, max_length: int, ellipsis: str = "...") -> str:
    """Truncate a string to ``max_length``, appending an ellipsis.

    Parameters
    ----------
    value
        Input string.
    max_length
        Maximum allowed length (including the ellipsis).
    ellipsis
        Suffix appended when truncated (default: ``"..."``).

    Returns
    -------
    str
        Truncated string.
    """
    if len(value) <= max_length:
        return value
    return value[: max_length - len(ellipsis)] + ellipsis


def safe_int(value: Any, default: int = 0) -> int:
    """Convert a value to int, returning a default on failure.

    Parameters
    ----------
    value
        Any value (string, float, None, …).
    default
        Value returned if conversion fails (default: 0).

    Returns
    -------
    int
        Integer result or default.
    """
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def safe_float(value: Any, default: float = 0.0) -> float:
    """Convert a value to float, returning a default on failure.

    Parameters
    ----------
    value
        Any value (string, int, None, …).
    default
        Value returned if conversion fails (default: 0.0).

    Returns
    -------
    float
        Float result or default.
    """
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


__all__ = [
    "format_currency_th",
    "parse_thai_date",
    "generate_invoice_number",
    "truncate_string",
    "safe_int",
    "safe_float",
]
