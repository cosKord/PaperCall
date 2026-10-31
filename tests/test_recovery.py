from sqlalchemy import select

from market_app.auth import create_user
from market_app.db import balance, connect, initialize, ledger
from tools.backup_db import backup_db


def test_backup_restores_ledger_balance(tmp_path):
    source = tmp_path / "source.db"
    target = tmp_path / "backup.db"
    initialize(source)
    with connect(source, write=True) as db:
        user_id = create_user(db, "alice@somaiya.edu", branch="CSE")
        db.execute(ledger.insert().values(user_id=user_id, amount=123, reason="opening", created_at="2026-10-31T00:00:00+00:00"))
    backup_db(source, target)
    with connect(target) as db:
        assert balance(db, user_id) == 123
        assert db.execute(select(ledger.c.amount)).scalar_one() == 123
