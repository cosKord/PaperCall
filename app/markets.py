"""Admin-defined markets and idempotent exam grants."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .auth import require_admin
from .database import (audit_log, balance, branch_exams, db_now, grant_claims,
                       ledger, markets, topics, users)


def _utc(value):
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ValueError("Timezone-aware date required")
    return value.astimezone(timezone.utc)


def create_market(db, admin_id, subject, exam_type, starts_at, ends_at, home_branches, branch_starts, grant_pts=None, min_stake=1, away_min_stake=10, low_cap_pct=20, high_cap_pct=40):
    require_admin(db, admin_id)
    starts_at, ends_at = _utc(starts_at), _utc(ends_at)
    if not subject.strip() or exam_type not in ("midsem", "endsem", "other") or ends_at <= starts_at or not branch_starts or not home_branches:
        raise ValueError("Invalid market details")
    if not set(home_branches).issubset(branch_starts) or any(not branch.strip() for branch in branch_starts):
        raise ValueError("Every home branch needs an exam schedule")
    branch_times = [_utc(v) for v in branch_starts.values()]
    first_start = min(branch_times)
    if ends_at <= max(branch_times):
        raise ValueError("Exam end must follow every branch start")
    if first_start < starts_at or first_start <= db_now(db):
        raise ValueError("Branch exam starts must be in the future")
    lockout = first_start
    if grant_pts is None:
        grant_pts = {"midsem": 100, "endsem": 150, "other": 100}[exam_type]
    if not (0 < min_stake <= away_min_stake <= grant_pts) or not (1 <= low_cap_pct <= 100 and 1 <= high_cap_pct <= 100):
        raise ValueError("Invalid stake or grant rules")
    market_id = db.execute(markets.insert().values(subject=subject.strip(), exam_type=exam_type, starts_at=starts_at.isoformat(), ends_at=ends_at.isoformat(), lockout_at=lockout.isoformat(), grant_pts=grant_pts, home_branches=list(home_branches), min_stake=min_stake, away_min_stake=away_min_stake, low_cap_pct=low_cap_pct, high_cap_pct=high_cap_pct, status="draft", legacy=False, review_needed=False)).inserted_primary_key[0]
    for branch, start in branch_starts.items():
        db.execute(branch_exams.insert().values(market_id=market_id, branch=branch, starts_at=_utc(start).isoformat()))
    db.execute(audit_log.insert().values(actor_id=admin_id, action="create_market", detail={"market_id": market_id}, created_at=db_now(db).isoformat()))
    return market_id


def add_topic(db, admin_id, market_id, title, tier):
    require_admin(db, admin_id)
    market = db.execute(select(markets.c.status).where(markets.c.id == market_id)).first()
    if not market or market.status != "draft" or tier not in ("low", "high") or not title.strip():
        raise ValueError("Draft market and valid topic required")
    return db.execute(topics.insert().values(market_id=market_id, title=title.strip(), tier=tier)).inserted_primary_key[0]


def publish_market(db, admin_id, market_id):
    require_admin(db, admin_id)
    if not db.execute(select(topics.c.id).where(topics.c.market_id == market_id)).first():
        raise ValueError("Add a topic first")
    if db.execute(markets.update().where(markets.c.id == market_id, markets.c.status == "draft").values(status="open")).rowcount != 1:
        raise ValueError("Only draft markets can be published")
    db.execute(audit_log.insert().values(actor_id=admin_id, action="publish_market", detail={"market_id": market_id}, created_at=db_now(db).isoformat()))


def lock_market(db, admin_id, market_id):
    require_admin(db, admin_id)
    now = db_now(db)
    if market_phase(db, market_id, now) != "open":
        raise ValueError("Only open markets can be locked")
    if db.execute(
        markets.update()
        .where(markets.c.id == market_id, markets.c.status == "open")
        .values(lockout_at=now.isoformat())
    ).rowcount != 1:
        raise ValueError("Only open markets can be locked")
    db.execute(audit_log.insert().values(actor_id=admin_id, action="lock_market", detail={"market_id": market_id}, created_at=now.isoformat()))


def market_phase(db, market_id, at=None):
    row = db.execute(select(markets).where(markets.c.id == market_id)).mappings().first()
    if not row:
        raise ValueError("Market not found")
    if row["status"] in ("draft", "settled"):
        return row["status"]
    at = _utc(at) if at else db_now(db)
    return "closed" if at >= datetime.fromisoformat(row["lockout_at"]) else "open"


def claim_grant(db, user_id, market_id):
    user = db.execute(select(users).where(users.c.id == user_id)).mappings().first()
    market = db.execute(select(markets).where(markets.c.id == market_id)).mappings().first()
    if not user or not user["active"] or not user["branch"] or not market or market["legacy"]:
        raise ValueError("Grant unavailable")
    if db.execute(select(grant_claims).where(grant_claims.c.user_id == user_id, grant_claims.c.market_id == market_id)).first():
        return market["grant_pts"]
    if market_phase(db, market_id) != "open":
        raise ValueError("Grant unavailable")
    if not db.execute(select(branch_exams.c.id).where(branch_exams.c.market_id == market_id, branch_exams.c.branch == user["branch"])).first():
        raise ValueError("Branch exam schedule required")
    db.execute(grant_claims.insert().values(user_id=user_id, market_id=market_id))
    db.execute(ledger.insert().values(user_id=user_id, market_id=market_id, amount=market["grant_pts"], reason="grant", created_at=db_now(db).isoformat()))
    return market["grant_pts"]
