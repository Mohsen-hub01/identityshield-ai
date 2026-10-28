import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from fastapi.security import OAuth2PasswordBearer


# Configuration
SECRET_KEY = os.getenv("IDENTITYSHIELD_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

password_hash = PasswordHash.recommended()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")


# Gestion des mots de passe
def get_password_hash(password: str) -> str:
    """Retourne le hash sécurisé d'un mot de passe."""
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """Vérifie un mot de passe à partir de son hash."""
    return password_hash.verify(
        plain_password,
        hashed_password,
    )


# Gestion des jetons JWT
def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """Crée un JWT signé avec une date d'expiration."""
    if not SECRET_KEY:
        raise RuntimeError(
            "IDENTITYSHIELD_SECRET_KEY n'est pas configurée."
        )

    payload = data.copy()

    expiration = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload["exp"] = expiration

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_access_token(
    token: str,
) -> dict[str, Any] | None:
    """Vérifie le JWT et retourne son contenu s'il est valide."""
    if not SECRET_KEY:
        raise RuntimeError(
            "IDENTITYSHIELD_SECRET_KEY n'est pas configurée."
        )

    try:
        return jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
    except InvalidTokenError:
        return None
