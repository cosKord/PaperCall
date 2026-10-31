"""Portable SQLite/Postgres schema and lossless prototype migration."""
import os
import sqlite3
from datetime import datetime, timezone
from contextlib import contextmanager
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from sqlalchemy import (Boolean, CheckConstraint, Column, ForeignKey, Integer,
                        JSON, MetaData, String, Table, Text, UniqueConstraint,
                        create_engine, func, select, text)
from sqlalchemy.engine import make_url

metadata = MetaData()
users = Table("users", metadata,
    Column("id", Integer, primary_key=True), Column("email", String(254), unique=True),
    Column("username", String(120), unique=True), Column("branch", String(80)),
    Column("role", String(20), nullable=False, default="player"),
    Column("active", Boolean, nullable=False, default=False),
    Column("totp_secret", String(64)), Column("created_at", String(40), nullable=False))
sessions = Table("sessions", metadata,
    Column("token_hash", String(64), primary_key=True), Column("user_id", ForeignKey("users.id"), nullable=False),
    Column("expires_at", String(40), nullable=False), Column("admin_verified", Boolean, nullable=False, default=False))
login_codes = Table("login_codes", metadata,
    Column("email", String(254), primary_key=True), Column("code_hash", String(64), nullable=False),
    Column("expires_at", String(40), nullable=False), Column("attempts", Integer, nullable=False, default=0),
    Column("last_sent_at", String(40), nullable=False))
markets = Table("markets", metadata,
    Column("id", Integer, primary_key=True), Column("subject", String(120), nullable=False),
    Column("exam_type", String(20), nullable=False), Column("starts_at", String(40), nullable=False),
    Column("ends_at", String(40)), Column("lockout_at", String(40), nullable=False),
    Column("grant_pts", Integer, nullable=False), Column("home_branches", JSON, nullable=False),
    Column("min_stake", Integer, nullable=False, default=1), Column("away_min_stake", Integer, nullable=False, default=10),
    Column("low_cap_pct", Integer, nullable=False, default=20), Column("high_cap_pct", Integer, nullable=False, default=40),
    Column("status", String(20), nullable=False), Column("paper_path", Text), Column("paper_hash", String(64)),
    Column("settled_at", String(40)), Column("legacy", Boolean, nullable=False, default=False),
    Column("review_needed", Boolean, nullable=False, default=False),
    CheckConstraint("grant_pts >= 0 AND min_stake > 0 AND away_min_stake >= min_stake"))
branch_exams = Table("branch_exams", metadata,
    Column("id", Integer, primary_key=True), Column("market_id", ForeignKey("markets.id"), nullable=False),
    Column("branch", String(80), nullable=False), Column("starts_at", String(40), nullable=False),
    UniqueConstraint("market_id", "branch"))
topics = Table("topics", metadata,
    Column("id", Integer, primary_key=True), Column("market_id", ForeignKey("markets.id"), nullable=False),
    Column("title", String(240), nullable=False), Column("tier", String(10), nullable=False),
    Column("outcome", String(10)), CheckConstraint("tier IN ('low','high')"))
bets = Table("bets", metadata,
    Column("id", Integer, primary_key=True), Column("user_id", ForeignKey("users.id"), nullable=False),
    Column("topic_id", ForeignKey("topics.id"), nullable=False), Column("side", String(10), nullable=False),
    Column("stake", Integer, nullable=False), Column("payout", Integer, nullable=False, default=0),
    Column("created_at", String(40), nullable=False), UniqueConstraint("user_id", "topic_id"),
    CheckConstraint("stake > 0"))
ledger = Table("ledger", metadata,
    Column("id", Integer, primary_key=True), Column("user_id", ForeignKey("users.id"), nullable=False),
    Column("market_id", ForeignKey("markets.id")), Column("bet_id", ForeignKey("bets.id")),
    Column("amount", Integer, nullable=False), Column("reason", String(20), nullable=False),
    Column("created_at", String(40), nullable=False),
    UniqueConstraint("user_id", "market_id", "reason", "bet_id"))
grant_claims = Table("grant_claims", metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("market_id", ForeignKey("markets.id"), primary_key=True))
audit_log = Table("audit_log", metadata,
    Column("id", Integer, primary_key=True), Column("actor_id", ForeignKey("users.id")),
    Column("action", String(80), nullable=False), Column("detail", JSON),
    Column("created_at", String(40), nullable=False))
settlement_previews = Table("settlement_previews", metadata,
    Column("market_id", ForeignKey("markets.id"), primary_key=True), Column("digest", String(64), nullable=False),
    Column("outcomes", JSON, nullable=False), Column("created_at", String(40), nullable=False))


def database_url(path=None):
    if path is None:
        path = os.environ.get("DATABASE_URL") or f"sqlite:///{Path(__file__).resolve().parents[1] / 'pilot.db'}"
    if isinstance(path, Path):
        return f"sqlite:///{path.resolve().as_posix()}"
    url = make_url(str(path))
    if url.drivername in ("postgresql", "postgres"):
        url = url.set(drivername="postgresql+psycopg")
    if url.drivername.startswith("postgresql") and "sslmode" not in url.query:
        url = url.update_query_dict({"sslmode": "require"})
    return url.render_as_string(hide_password=False)


@lru_cache(maxsize=8)
def engine_for(url):
    kwargs = {"future": True, "pool_pre_ping": True}
    if url.startswith("sqlite:"):
        kwargs["connect_args"] = {"timeout": 15, "check_same_thread": False}
    return create_engine(url, **kwargs)


def initialize(path=None):
    engine = engine_for(database_url(path))
    metadata.create_all(engine)
    if engine.dialect.name == "postgresql":
        with engine.begin() as db:
            for table_name in metadata.tables:
                db.exec_driver_sql(f'ALTER TABLE "{table_name}" ENABLE ROW LEVEL SECURITY')
    return engine


@contextmanager
def connect(path=None, write=False):
    engine = engine_for(database_url(path))
    with engine.connect() as db:
        try:
            if write and engine.dialect.name == "sqlite":
                db.exec_driver_sql("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise


def balance(db, user_id):
    return int(db.execute(select(func.coalesce(func.sum(ledger.c.amount), 0)).where(ledger.c.user_id == user_id)).scalar_one())


def db_now(db):
    """Read database time inside the caller's transaction."""
    if db.engine.dialect.name == "sqlite":
        value = db.exec_driver_sql("SELECT strftime('%Y-%m-%dT%H:%M:%f+00:00','now')").scalar_one()
        return datetime.fromisoformat(value)
    value = db.exec_driver_sql("SELECT clock_timestamp()").scalar_one()
    return value.astimezone(timezone.utc)


@dataclass(frozen=True)
class MigrationReport:
    users: int
    markets: int
    bets: int


def migrate_demo(source: Path, target: Path | str, dry_run: bool = True) -> MigrationReport:
    """Migrate legacy data into a new DB. Never overwrite the old database."""
    url = make_url(database_url(target))
    if url.drivername.startswith("sqlite"):
        target_file = Path(url.database)
        if source.resolve() == target_file.resolve() or target_file.exists():
            raise ValueError("Migration target must be a new database")
    old = sqlite3.connect(source)
    old.row_factory = sqlite3.Row
    try:
        old_users = old.execute("SELECT * FROM users ORDER BY id").fetchall()
        old_exams = old.execute("SELECT * FROM exams ORDER BY id").fetchall()
        old_markets = old.execute("SELECT * FROM markets ORDER BY id").fetchall()
        old_bets = old.execute("SELECT * FROM bets ORDER BY id").fetchall()
        report = MigrationReport(len(old_users), len(old_exams), len(old_bets))
        if dry_run:
            return report
        initialize(target)
        with connect(target, write=True) as db:
            if db.execute(select(func.count()).select_from(users)).scalar_one() or db.execute(select(func.count()).select_from(markets)).scalar_one():
                raise ValueError("Migration target must be empty")
            for u in old_users:
                db.execute(users.insert().values(id=u["id"], username=u["username"], role=u["role"], active=False, created_at="1970-01-01T00:00:00+00:00"))
            for e in old_exams:
                related = [m for m in old_markets if m["exam_id"] == e["id"]]
                settled = bool(related) and all(m["result"] is not None for m in related)
                db.execute(markets.insert().values(id=e["id"], subject=e["title"], exam_type="other", starts_at=e["starts_at"], lockout_at=e["starts_at"], grant_pts=0, home_branches=[], min_stake=1, away_min_stake=10, low_cap_pct=20, high_cap_pct=40, status="settled" if settled else "closed", legacy=True, review_needed=not settled))
            for m in old_markets:
                outcome = {"YES": "hit", "NO": "miss"}.get(m["result"])
                db.execute(topics.insert().values(id=m["id"], market_id=m["exam_id"], title=m["prompt"], tier="low" if m["kind"] == "topic" else "high", outcome=outcome))
            for b in old_bets:
                db.execute(bets.insert().values(id=b["id"], user_id=b["user_id"], topic_id=b["market_id"], side="hit" if b["side"] == "YES" else "miss", stake=b["stake"], payout=b["payout"], created_at=b["created_at"]))
            for u in old_users:
                db.execute(ledger.insert().values(user_id=u["id"], amount=1000, reason="opening", created_at="1970-01-01T00:00:00+00:00"))
            for b in old_bets:
                market = next(m for m in old_markets if m["id"] == b["market_id"])
                db.execute(ledger.insert().values(user_id=b["user_id"], market_id=market["exam_id"], bet_id=b["id"], amount=-b["stake"], reason="bet", created_at=b["created_at"]))
                if market["result"] is not None and b["payout"]:
                    db.execute(ledger.insert().values(user_id=b["user_id"], market_id=market["exam_id"], bet_id=b["id"], amount=b["payout"], reason="refund" if market["settlement"] == "refund" else "payout", created_at=b["created_at"]))
            for u in old_users:
                if balance(db, u["id"]) != u["balance"]:
                    raise ValueError(f"Balance reconciliation failed for legacy user {u['id']}")
            if db.engine.dialect.name == "postgresql":
                for name in ("users", "markets", "topics", "bets"):
                    db.exec_driver_sql(f"SELECT setval(pg_get_serial_sequence('{name}', 'id'), COALESCE((SELECT MAX(id) FROM {name}), 1), true)")
        return report
    finally:
        old.close()
