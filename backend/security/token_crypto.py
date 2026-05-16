"""
Cifrado simétrico de tokens de plataforma (Meta/TikTok/Google access + refresh tokens).

Las credenciales viajan a la DB cifradas con Fernet (AES-128-CBC + HMAC-SHA256)
usando una key única por instalación que vive en `PLATFORM_TOKENS_ENC_KEY`.

Generar key:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Si la key no está seteada, el primer llamado a encrypt/decrypt falla con error
claro — no fallar al import para no romper tests que no usan crypto.
"""
from __future__ import annotations

import os
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

_ENV_KEY = "PLATFORM_TOKENS_ENC_KEY"


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = os.environ.get(_ENV_KEY, "").strip()
    if not key:
        raise RuntimeError(
            f"{_ENV_KEY} no está seteada. Generala con: "
            'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )
    try:
        return Fernet(key.encode())
    except ValueError as e:
        raise RuntimeError(
            f"{_ENV_KEY} inválida — debe ser una Fernet key base64 de 32 bytes"
        ) from e


def encrypt_token(plain: str) -> str:
    """Encripta un string a un ciphertext base64 url-safe."""
    if not plain:
        raise ValueError("encrypt_token: input vacío")
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_token(ciphered: str) -> str:
    """Desencripta un ciphertext generado por encrypt_token. Lanza ValueError si la key no matchea."""
    if not ciphered:
        raise ValueError("decrypt_token: input vacío")
    try:
        return _fernet().decrypt(ciphered.encode("ascii")).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("decrypt_token: ciphertext inválido o key no coincide") from e


__all__ = ["encrypt_token", "decrypt_token"]
