"""Hashing y verificación de passwords con bcrypt (directo, sin passlib).

passlib 1.7.4 tiene un bug de detección de "wrap bug" con bcrypt >= 4.1 que
revienta en cada llamada a `hash()` con `ValueError: password cannot be longer
than 72 bytes`. Usamos `bcrypt` directamente y truncamos a 72 bytes manualmente
si hace falta (bcrypt clásicamente lo hace, pero la nueva lib rechaza).
"""
from __future__ import annotations

import bcrypt

_BCRYPT_MAX = 72  # límite duro de la lib bcrypt


def _normalize(plain: str) -> bytes:
    b = plain.encode("utf-8")
    return b[:_BCRYPT_MAX]  # truncate — comportamiento clásico de bcrypt


def hash_password(plain: str) -> str:
    if not plain:
        raise ValueError("password vacío")
    hashed = bcrypt.hashpw(_normalize(plain), bcrypt.gensalt(rounds=12))
    return hashed.decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(_normalize(plain), hashed.encode("ascii"))
    except (ValueError, TypeError):
        return False
