"""Input sanitization and business validation helpers (SDD.md §9.2).

This module provides reusable validation functions used across all
modules for input sanitization, format checking, and business-rule
enforcement.  Each function raises ``ValueError`` with a descriptive
message when validation fails.

Planned functions (Phase 2+):
    - ``validate_thai_id_card()`` — Thai 13-digit ID checksum
    - ``validate_meter_values()`` — Meter reading monotonicity
    - ``sanitize_filename()`` — Strip path separators and special chars
    - ``sanitize_html()`` — Strip XSS vectors from user input

References:
    - SDD.md §9.2: shared/validators.py specification
    - CODE_STYLE.md §1.1: Project structure
"""

import re


def sanitize_input(value: str, max_length: int = 1000) -> str:
    """Strip leading/trailing whitespace and remove control characters.

    This is a generic sanitizer for free-text input fields.
    For module-specific validation (ID cards, meter readings, …) use
    the dedicated functions below.

    Parameters
    ----------
    value
        Raw user-supplied string.
    max_length
        Maximum allowed length after sanitization (default: 1000).

    Returns
    -------
    str
        Sanitised string with control characters removed.

    Raises
    ------
    ValueError
        If the result exceeds ``max_length``.
    """
    # Strip control characters except newline and tab
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value.strip())
    if len(cleaned) > max_length:
        raise ValueError(f"Input exceeds maximum length of {max_length} characters")
    return cleaned


def sanitize_filename(filename: str) -> str:
    """Remove path separators and dangerous characters from a filename.

    Keeps alphanumerics, hyphens, underscores, dots, and spaces.
    This prevents path-traversal attacks when storing uploaded files.

    Parameters
    ----------
    filename
        The raw filename (e.g. from ``Content-Disposition`` header).

    Returns
    -------
    str
        A safe filename with no path components and no special chars.

    Raises
    ------
    ValueError
        If the result is empty after sanitization.
    """
    # Remove directory separators and null bytes
    safe = re.sub(r"[/\\\x00]", "", filename.strip())
    # Replace dots-only blocks (path traversal via ..)
    safe = re.sub(r"\.\.+", "_", safe)
    # Keep only safe characters
    safe = re.sub(r"[^\w\-\. ]", "_", safe)
    # Collapse multiple underscores
    safe = re.sub(r"_+", "_", safe)
    # Strip leading/trailing dots and underscores
    safe = safe.strip("._ ")
    if not safe:
        raise ValueError("Filename is empty after sanitization")
    return safe


def validate_thai_id_card(id_number: str) -> bool:
    """Validate a Thai 13-digit national ID number using the checksum algorithm.

    The last digit is a checksum computed as:
        checksum = (11 - (sum of digit[i] * (13 - i) for i in 0..11) % 11) % 10

    Parameters
    ----------
    id_number
        The 13-digit ID card number as a string (digits only).

    Returns
    -------
    bool
        ``True`` if the number passes the checksum, ``False`` otherwise.

    Raises
    ------
    ValueError
        If the input is not exactly 13 digits.
    """
    if not re.match(r"^\d{13}$", id_number):
        raise ValueError("Thai ID card must be exactly 13 digits")

    digits = [int(d) for d in id_number[:12]]
    checksum_digit = int(id_number[12])

    total = sum(d * (13 - i) for i, d in enumerate(digits))
    expected_checksum = (11 - (total % 11)) % 10

    return checksum_digit == expected_checksum


def validate_thai_phone(phone: str) -> bool:
    """Validate a Thai mobile phone number.

    Accepts formats:
        - ``0812345678`` (10 digits, starting with 0)
        - ``+66812345678`` (international, 11 digits after +66)

    Parameters
    ----------
    phone
        Phone number string.

    Returns
    -------
    bool
        ``True`` if the format is valid.

    Raises
    ------
    ValueError
        If the input is not a valid Thai phone number.
    """
    cleaned = re.sub(r"[\s\-\(\)]", "", phone)

    # Local format: 0XXXXXXXXX (10 digits)
    if re.match(r"^0\d{9}$", cleaned):
        return True

    # International format: +66XXXXXXXXX (9 digits after 66)
    if re.match(r"^\+66\d{9}$", cleaned):
        return True

    raise ValueError("Invalid Thai phone number format")


def validate_meter_values(
    previous: float,
    current: float,
    max_allowable_increase: float | None = None,
) -> bool:
    """Validate that meter readings are monotonically non-decreasing.

    Parameters
    ----------
    previous
        The previous meter reading value.
    current
        The current meter reading value.
    max_allowable_increase
        Optional cap on the allowed increase (e.g. 99999 to flag
        a potential misread).

    Returns
    -------
    bool
        ``True`` if the reading is valid.

    Raises
    ------
    ValueError
        If the current reading is less than the previous reading,
        or if the increase exceeds ``max_allowable_increase``.
    """
    if current < previous:
        raise ValueError(
            f"Current reading ({current}) is less than previous ({previous})"
        )

    if max_allowable_increase is not None:
        increase = current - previous
        if increase > max_allowable_increase:
            raise ValueError(
                f"Reading increase ({increase}) exceeds maximum allowed "
                f"({max_allowable_increase})"
            )

    return True


__all__ = [
    "sanitize_input",
    "sanitize_filename",
    "validate_thai_id_card",
    "validate_thai_phone",
    "validate_meter_values",
]
