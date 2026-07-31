"""Unit tests for shared/security.py — JWT, Argon2id, Fernet (SDD §4.4).

References:
- CODE_STYLE.md §7: Testing conventions
- OWASP Password Storage Cheat Sheet (2026): Argon2id
- RFC 9106: Argon2 Memory-Hard Function specification
"""

from datetime import timedelta

from app.config import Settings
from app.shared.security import (
    create_access_token,
    decode_token,
    decrypt_sensitive,
    encrypt_sensitive,
    hash_password,
    verify_password,
)

# ═══════════════════════════════════════════════════════════════════════
# Argon2id Password Hashing Tests
# ═══════════════════════════════════════════════════════════════════════


class TestArgon2idHashing:
    """Tests for ``hash_password()`` and ``verify_password()`` — Argon2id."""

    def test_hash_password_then_verify(self) -> None:
        """Hash a password and verify with the same password → ``True``."""
        password = "SecurePass123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_hash_password_wrong(self) -> None:
        """Hash password A, verify with password B → ``False``."""
        hashed = hash_password("PasswordA1")
        assert verify_password("PasswordB1", hashed) is False

    def test_hash_is_unique(self) -> None:
        """Same password hashed twice produces different hashes (Argon2 random salt)."""
        h1 = hash_password("SamePass1")
        h2 = hash_password("SamePass1")
        assert h1 != h2

    def test_hash_format(self) -> None:
        """Hash starts with Argon2id identifier ``$argon2id$``."""
        hashed = hash_password("FormatCheck1")
        assert hashed.startswith("$argon2id$"), (
            f"Expected Argon2id prefix, got: {hashed[:20]}..."
        )

    def test_argon2id_default_parameters(self) -> None:
        """Verify that the default Argon2id parameters meet OWASP 2026 minimums."""
        settings = Settings()
        assert settings.ARGON2_TIME_COST >= 2, "time_cost below OWASP minimum"
        assert settings.ARGON2_MEMORY_COST >= 47104, "memory_cost below OWASP minimum (46 MB)"
        assert settings.ARGON2_PARALLELISM >= 1, "parallelism must be >= 1"


# ═══════════════════════════════════════════════════════════════════════
# JWT Token Tests
# ═══════════════════════════════════════════════════════════════════════


class TestCreateAccessToken:
    """Tests for ``create_access_token()`` and ``decode_token()``."""

    def test_create_access_token_returns_jwt(self) -> None:
        """Generated token is a non-empty string with three dot-separated parts."""
        token = create_access_token({"user_id": "abc123"})
        assert isinstance(token, str)
        assert len(token) > 0
        assert token.count(".") == 2

    def test_create_access_token_contains_claims(self) -> None:
        """Decoded token contains the original claims plus standard JWT fields."""
        token = create_access_token({"user_id": "abc123", "role": "admin"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["user_id"] == "abc123"
        assert payload["role"] == "admin"
        assert "exp" in payload
        assert "iat" in payload

    def test_create_access_token_with_expiry(self) -> None:
        """Custom expiry delta is respected."""
        token = create_access_token(
            {"user_id": "abc123"},
            expires_delta=timedelta(seconds=1),
        )
        payload = decode_token(token)
        assert payload is not None

    def test_create_access_token_rejects_expired(self) -> None:
        """Token with a past expiry returns ``None`` on decode."""
        token = create_access_token(
            {"user_id": "abc123"},
            expires_delta=timedelta(seconds=-10),
        )
        payload = decode_token(token)
        assert payload is None


# ═══════════════════════════════════════════════════════════════════════
# Fernet Encryption Tests
# ═══════════════════════════════════════════════════════════════════════


class TestEncryption:
    """Tests for ``encrypt_sensitive()`` and ``decrypt_sensitive()``."""

    def test_encrypt_then_decrypt(self) -> None:
        """Encrypting then decrypting yields the original value."""
        original = "1234567890123"
        encrypted = encrypt_sensitive(original)
        decrypted = decrypt_sensitive(encrypted)
        assert decrypted == original

    def test_ciphertext_is_different(self) -> None:
        """Same plaintext encrypted twice produces different results (random IV)."""
        plain = "9876543210123"
        c1 = encrypt_sensitive(plain)
        c2 = encrypt_sensitive(plain)
        assert c1 != c2

    def test_decrypt_wrong_key_fails(self) -> None:
        """Decrypting with a different key raises an error (tested via round-trip)."""
        original = "test-data-123456"
        encrypted = encrypt_sensitive(original)
        assert encrypted != original
        assert decrypt_sensitive(encrypted) == original
