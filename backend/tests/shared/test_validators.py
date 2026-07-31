"""Unit tests for shared/validators.py (sanitization and validation helpers)."""

import pytest

from app.shared.validators import (
    sanitize_filename,
    sanitize_input,
    validate_meter_values,
    validate_thai_id_card,
    validate_thai_phone,
)


class TestSanitizeInput:
    def test_sanitize_input_normal(self) -> None:
        assert sanitize_input("  hello world  ") == "hello world"

    def test_sanitize_input_control_chars(self) -> None:
        raw = "hello\x00\x07world"
        assert sanitize_input(raw) == "helloworld"

    def test_sanitize_input_exceeds_max_length(self) -> None:
        with pytest.raises(ValueError, match="Input exceeds maximum length"):
            sanitize_input("a" * 105, max_length=100)


class TestSanitizeFilename:
    def test_sanitize_filename_normal(self) -> None:
        assert sanitize_filename("my_document.pdf") == "my_document.pdf"

    def test_sanitize_filename_path_traversal(self) -> None:
        assert sanitize_filename("../../etc/passwd") == "etcpasswd"

    def test_sanitize_filename_empty(self) -> None:
        with pytest.raises(ValueError, match="Filename is empty"):
            sanitize_filename("///")


class TestValidateThaiIdCard:
    def test_valid_id_card(self) -> None:
        assert validate_thai_id_card("1234567890121") is True

    def test_invalid_length_or_digits(self) -> None:
        with pytest.raises(ValueError):
            validate_thai_id_card("12345")
        with pytest.raises(ValueError):
            validate_thai_id_card("123456789012A")

    def test_invalid_checksum(self) -> None:
        assert validate_thai_id_card("1234567890123") is False


class TestValidateThaiPhone:
    def test_valid_phone_numbers(self) -> None:
        assert validate_thai_phone("0812345678") is True
        assert validate_thai_phone("+66812345678") is True

    def test_invalid_phone_numbers(self) -> None:
        with pytest.raises(ValueError):
            validate_thai_phone("12345")
        with pytest.raises(ValueError):
            validate_thai_phone("0812345678999")


class TestValidateMeterValues:
    def test_valid_meter_values(self) -> None:
        assert validate_meter_values(100, 150) is True

    def test_invalid_meter_values(self) -> None:
        with pytest.raises(ValueError):
            validate_meter_values(150, 100)
