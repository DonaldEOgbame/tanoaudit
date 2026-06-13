"""Generate fresh production secrets.

Run:  python -m scripts.generate_secrets
Prints a JWT_SECRET and a FERNET_KEY ready to paste into your .env.
"""
from __future__ import annotations

import secrets

from cryptography.fernet import Fernet


def main() -> None:
    print("# Paste these into your .env (keep them secret):")
    print(f"JWT_SECRET={secrets.token_urlsafe(48)}")
    print(f"FERNET_KEY={Fernet.generate_key().decode()}")


if __name__ == "__main__":
    main()
