"""Create the first admin and print a TOTP provisioning URI locally."""
import argparse

import pyotp
from sqlalchemy import select

from market_app.auth import create_user
from market_app.db import connect, initialize, users


def bootstrap_admin(path=None, email="admin@somaiya.edu"):
    initialize(path)
    with connect(path, write=True) as db:
        user_id = create_user(db, email, role="admin")
        row = db.execute(select(users).where(users.c.id == user_id)).mappings().one()
        if row["role"] != "admin":
            raise ValueError("Email belongs to a player; choose a different admin address")
        secret = row["totp_secret"] or pyotp.random_base32()
        if not row["totp_secret"]:
            db.execute(users.update().where(users.c.id == user_id).values(totp_secret=secret))
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="PaperCall")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", default="admin@somaiya.edu")
    args = parser.parse_args()
    print("Add this URI to an authenticator app and keep it private:")
    print(bootstrap_admin(email=args.email))


if __name__ == "__main__":
    main()
