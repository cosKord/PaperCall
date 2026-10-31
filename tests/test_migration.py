from datetime import datetime, timedelta, timezone

from app import Store
from sqlalchemy import text
from market_app.db import balance, connect, migrate_demo


def test_migration_reconciles_legacy_balances_and_preserves_results(tmp_path):
    old_path = tmp_path / "old.db"
    old = Store(old_path)
    old.initialize()
    admin = old.authenticate("admin", "admin123")
    alice = old.authenticate("alice", "player123")
    bob = old.authenticate("bob", "player123")
    exam = old.create_exam(admin, "FCOA", (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat())
    won = old.create_market(admin, exam, "topic", "IAS")
    pending = old.create_market(admin, exam, "question", "Booth")
    refunded = old.create_market(admin, exam, "topic", "Pipelining")
    old.place_bet(alice, won, "YES", 100)
    old.place_bet(bob, won, "NO", 50)
    old.place_bet(bob, pending, "YES", 20)
    old.place_bet(bob, refunded, "NO", 10)
    old.lock_exam(admin, exam)
    with old.connect() as db:
        db.execute("UPDATE exams SET starts_at=? WHERE id=?", ((datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(), exam))
    old.settle_market(admin, won, "YES")
    old.settle_market(admin, refunded, "YES")

    report = migrate_demo(old_path, tmp_path / "pilot.db", dry_run=False)
    assert (report.users, report.markets, report.bets) == (3, 1, 4)
    with connect(tmp_path / "pilot.db") as db:
        for user_id in (admin, alice, bob):
            assert balance(db, user_id) == old.balance(user_id)
        results = db.execute(text("SELECT title,outcome FROM topics ORDER BY id")).fetchall()
        assert [(r[0], r[1]) for r in results] == [("IAS", "hit"), ("Booth", None), ("Pipelining", "hit")]
        assert db.execute(text("SELECT COUNT(*) FROM ledger WHERE reason='payout'")).fetchone()[0] == 1
        assert db.execute(text("SELECT COUNT(*) FROM ledger WHERE reason='refund'")).fetchone()[0] == 1
        assert db.execute(text("SELECT COUNT(*) FROM ledger WHERE reason='bet'")).fetchone()[0] == 4
