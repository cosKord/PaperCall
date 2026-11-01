import sqlite3
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from app.database import balance, connect, database_url, migrate_demo


def create_legacy_database(path, with_bets=True):
    with sqlite3.connect(path) as db:
        db.executescript("""
            CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 1000);
            CREATE TABLE exams (id INTEGER PRIMARY KEY, title TEXT NOT NULL, starts_at TEXT NOT NULL, locked INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE markets (id INTEGER PRIMARY KEY, exam_id INTEGER NOT NULL, kind TEXT NOT NULL, prompt TEXT NOT NULL, result TEXT, settlement TEXT);
            CREATE TABLE bets (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, market_id INTEGER NOT NULL, side TEXT NOT NULL, stake INTEGER NOT NULL, payout INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
        """)
        db.executemany("INSERT INTO users(id,username,password,role,balance) VALUES(?,?,?,?,?)", [
            (1, "admin", "unused", "admin", 1000),
            (2, "alice", "unused", "player", 1050 if with_bets else 1000),
            (3, "bob", "unused", "player", 930 if with_bets else 1000),
        ])
        if not with_bets:
            return
        now = datetime.now(timezone.utc).isoformat()
        db.execute("INSERT INTO exams VALUES(1,'FCOA',?,1)", (now,))
        db.executemany("INSERT INTO markets VALUES(?,?,?,?,?,?)", [
            (1, 1, "topic", "IAS", "YES", "normal"),
            (2, 1, "question", "Booth", None, None),
            (3, 1, "topic", "Pipelining", "YES", "refund"),
        ])
        db.executemany("INSERT INTO bets VALUES(?,?,?,?,?,?,?)", [
            (1, 2, 1, "YES", 100, 150, now),
            (2, 3, 1, "NO", 50, 0, now),
            (3, 3, 2, "YES", 20, 0, now),
            (4, 3, 3, "NO", 10, 10, now),
        ])


def test_migration_reconciles_legacy_balances_and_preserves_results(tmp_path):
    old_path = tmp_path / "old.db"
    create_legacy_database(old_path)

    report = migrate_demo(old_path, tmp_path / "pilot.db", dry_run=False)
    assert (report.users, report.markets, report.bets) == (3, 1, 4)
    with connect(tmp_path / "pilot.db") as db:
        assert [balance(db, user_id) for user_id in (1, 2, 3)] == [1000, 1050, 930]
        results = db.execute(text("SELECT title,outcome FROM topics ORDER BY id")).fetchall()
        assert [(r[0], r[1]) for r in results] == [("IAS", "hit"), ("Booth", None), ("Pipelining", "hit")]
        assert db.execute(text("SELECT COUNT(*) FROM ledger WHERE reason='payout'")).fetchone()[0] == 1
        assert db.execute(text("SELECT COUNT(*) FROM ledger WHERE reason='refund'")).fetchone()[0] == 1
        assert db.execute(text("SELECT COUNT(*) FROM ledger WHERE reason='bet'")).fetchone()[0] == 4


def test_supabase_url_uses_psycopg_and_ssl(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://postgres.example:password@pooler.supabase.com:5432/postgres")
    url = database_url()
    assert url.startswith("postgresql+psycopg://")
    assert "sslmode=require" in url


def test_migration_accepts_database_url_and_rejects_nonempty_target(tmp_path):
    old_path = tmp_path / "old.db"
    create_legacy_database(old_path, with_bets=False)
    target = tmp_path / "new.db"
    target_url = f"sqlite:///{target.as_posix()}"
    assert migrate_demo(old_path, target_url, dry_run=False).users == 3
    with pytest.raises(ValueError):
        migrate_demo(old_path, target_url, dry_run=False)
