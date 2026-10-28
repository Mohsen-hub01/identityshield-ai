import os

from auth_security import get_password_hash, verify_password


def load_users() -> dict:
    """Charge les comptes configurés dans l'environnement."""
    accounts = [
        ("IDENTITYSHIELD_ADMIN", "admin"),
        ("IDENTITYSHIELD_ANALYST", "analyst"),
        ("IDENTITYSHIELD_VIEWER", "viewer"),
    ]

    users = {}

    for prefix, role in accounts:
        username = os.getenv(f"{prefix}_USERNAME")
        password = os.getenv(f"{prefix}_PASSWORD")

        # Un compte incomplet n'est pas créé.
        if not username or not password:
            continue

        username = username.strip()

        if not username:
            continue

        if username in users:
            raise ValueError("Deux comptes ont le même identifiant.")

        users[username] = {
            "username": username,
            "hashed_password": get_password_hash(password),
            "role": role,
            "disabled": False,
        }

    return users


def get_user(username: str) -> dict | None:
    """Recherche un compte à partir de son identifiant."""
    return load_users().get(username)


def authenticate_user(
    username: str,
    password: str,
) -> dict | None:
    """Vérifie les identifiants et retourne un compte autorisé."""
    user = get_user(username)

    if user is None or user["disabled"]:
        return None

    if not verify_password(password, user["hashed_password"]):
        return None

    # Ne jamais renvoyer le hash du mot de passe au client.
    return {
        "username": user["username"],
        "role": user["role"],
        "disabled": user["disabled"],
    }