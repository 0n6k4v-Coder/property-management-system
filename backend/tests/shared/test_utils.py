"""Unit tests for shared/utils.py."""

from datetime import date

import pytest

from app.shared.utils import (
    format_currency_th,
    generate_invoice_number,
    parse_thai_date,
    safe_float,
    safe_int,
    truncate_string,
)


class TestFormatCurrencyTh:
    def test_format_currency_with_suffix(self) -> None:
        assert format_currency_th(1234567.50) == "1,234,567.50 บาท"

    def test_format_currency_without_suffix(self) -> None:
        assert format_currency_th(50000, include_baht_suffix=False) == "50,000.00"


class TestParseThaiDate:
    def test_parse_iso(self) -> None:
        assert parse_thai_date("2026-12-31") == date(2026, 12, 31)

    def test_parse_buddhist_era(self) -> None:
        assert parse_thai_date("31/12/2569") == date(2026, 12, 31)

    def test_parse_invalid_format(self) -> None:
        with pytest.raises(ValueError, match="Unrecognised date format"):
            parse_thai_date("invalid-date")


class TestGenerateInvoiceNumber:
    def test_generate_invoice_number(self) -> None:
        assert generate_invoice_number("INV", 2026, 7, 1) == "INV-202607-0001"


class TestTruncateString:
    def test_truncate(self) -> None:
        assert truncate_string("Hello World", 8) == "Hello..."
        assert truncate_string("Short", 10) == "Short"


class TestSafeConverters:
    def test_safe_int(self) -> None:
        assert safe_int("123") == 123
        assert safe_int("abc", 99) == 99

    def test_safe_float(self) -> None:
        assert safe_float("123.45") == 123.45
        assert safe_float(None, 0.0) == 0.0
