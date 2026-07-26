"""Security utilities: JWT, Argon2id password hashing, Fernet encryption (SDD.md §4.4).

References:
- OWASP Password Storage Cheat Sheet (2026): Argon2id recommended
- RFC 9106: Argon2 Memory-Hard Function specification
- CODE_STYLE.md §6: Security Guidelines
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from cryptography.fernet import Fernet
from passlib.context import CryptContext

from app.config import get_settings

_settings = get_settings()

# Password hashing — Argon2id (OWASP 2026 recommendation, RFC 9106)
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    argon2__time_cost=_settings.ARGON2_TIME_COST,
    argon2__memory_cost=_settings.ARGON2_MEMORY_COST,
    argon2__parallelism=_settings.ARGON2_PARALLELISM,
    argon2__type="ID",
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against an Argon2id hash."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password with Argon2id.

    Returns a ``$argon2id$``-prefixed hash string suitable for
    persistent storage.

    Parameters
    ----------
    plain_password
        The plain-text password to hash.

    Returns
    -------
    str
        Argon2id hash string.
    """
    return pwd_context.hash(plain_password)


# JWT utilities
def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token.

    Each token includes a unique ``jti`` (JWT ID) claim so that even
    tokens with identical payloads generated within the same second
    produce different signatures.  This is critical for token rotation
    verification in integration tests.

    Parameters
    ----------
    data
        Claims to embed in the token (e.g. ``user_id``, ``email``).
    expires_delta
        Optional custom expiry.  Defaults to
        ``ACCESS_TOKEN_EXPIRE_MINUTES`` from settings.

    Returns
    -------
    str
        Encoded JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=_settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "jti": uuid.uuid4().hex,  # unique token ID for rotation verification
        "exp": expire,
        "iat": datetime.now(UTC),
    })
    return jwt.encode(to_encode, _settings.SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a JWT token.

    Parameters
    ----------
    token
        Encoded JWT string.

    Returns
    -------
    dict[str, Any] | None
        Decoded payload on success, ``None`` on any failure
        (expired, malformed, invalid signature).
    """
    try:
        return jwt.decode(token, _settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


async def verify_token(token: str) -> dict[str, Any] | None:
    """Verify JWT token and return user payload.

    .. note::
        Token rotation / revocation check is planned for Phase 2.
    """
    payload = decode_token(token)
    if not payload:
        return None
    return payload


# Encryption for sensitive data (ID cards, etc.)
_cipher = Fernet(_settings.ID_CARD_ENCRYPTION_KEY.encode())


def encrypt_sensitive(plaintext: str) -> str:
    """Encrypt sensitive string using Fernet (AES-128-CBC + HMAC)."""
    return _cipher.encrypt(plaintext.encode()).decode()


def decrypt_sensitive(ciphertext: str) -> str:
    """Decrypt Fernet ciphertext back to plaintext."""
    return _cipher.decrypt(ciphertext.encode()).decode()
