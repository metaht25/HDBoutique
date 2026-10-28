"""Argon2id passwords and random session secrets; store only token digests."""

from functools import lru_cache
from hashlib import sha256
from secrets import compare_digest, token_urlsafe

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

PASSWORD_HASHER = PasswordHasher()


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


@lru_cache(maxsize=1)
def dummy_password_hash() -> str:
    return hash_password(token_urlsafe(32))


def verify_password(encoded: str, password: str) -> bool:
    try:
        return PASSWORD_HASHER.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def digest_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def matches_token(token: str | None, expected: str) -> bool:
    return bool(
        token and len(token) <= 128 and compare_digest(digest_token(token), expected)
    )


def new_token() -> str:
    return token_urlsafe(32)
