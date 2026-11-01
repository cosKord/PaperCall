from sqlalchemy import select

from app.database import connect, initialize, users
from scripts.bootstrap_admin import bootstrap_admin


def test_admin_bootstrap_is_idempotent_and_keeps_totp_secret(tmp_path):
    path = tmp_path / "admin.db"
    initialize(path)
    first = bootstrap_admin(path, "admin@somaiya.edu")
    second = bootstrap_admin(path, "admin@somaiya.edu")
    assert first.startswith("otpauth://totp/")
    assert first == second
    with connect(path) as db:
        admin = db.execute(select(users).where(users.c.email == "admin@somaiya.edu")).mappings().one()
        assert admin["role"] == "admin" and admin["active"]
        assert admin["totp_secret"]
