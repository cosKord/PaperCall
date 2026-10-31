"""Atomic, server-timed point bets."""
from datetime import datetime

from sqlalchemy import select

from .db import balance, bets, branch_exams, db_now, ledger, markets, topics, users
from .markets import market_phase


class BetError(ValueError):
    pass


def place_bet(db, user_id, topic_id, side, stake):
    if type(stake) is not int or stake <= 0 or side not in ("hit", "miss"):
        raise BetError("Choose hit/miss and a positive whole-point stake")
    # The caller opens a write transaction before this read. Postgres also locks
    # the player's row so two sessions cannot spend the same ledger balance.
    user = db.execute(select(users).where(users.c.id == user_id).with_for_update()).mappings().first()
    topic = db.execute(select(topics).where(topics.c.id == topic_id)).mappings().first()
    if not user or not user["active"] or user["role"] != "player" or not user["branch"] or not topic:
        raise BetError("Verified player and topic required")
    market = db.execute(select(markets).where(markets.c.id == topic["market_id"])).mappings().one()
    receipt_time = db_now(db)
    if market_phase(db, market["id"], receipt_time) != "open" or receipt_time >= datetime.fromisoformat(market["lockout_at"]):
        raise BetError("Betting is closed")
    branch_exam = db.execute(select(branch_exams.c.starts_at).where(branch_exams.c.market_id == market["id"], branch_exams.c.branch == user["branch"])).first()
    if not branch_exam:
        raise BetError("Admin must verify your branch's exam time for this market")
    if branch_exam and receipt_time >= datetime.fromisoformat(branch_exam[0]):
        raise BetError("Your branch has already written this exam")
    if db.execute(select(bets.c.id).where(bets.c.user_id == user_id, bets.c.topic_id == topic_id)).first():
        raise BetError("One final bet per topic")
    available = balance(db, user_id)
    minimum = market["min_stake"] if user["branch"] in market["home_branches"] else market["away_min_stake"]
    cap_pct = market["low_cap_pct"] if topic["tier"] == "low" else market["high_cap_pct"]
    maximum = available * cap_pct // 100
    if stake < minimum or stake > maximum or stake > available:
        raise BetError(f"Stake must be between {minimum} and {maximum} points")
    bet_id = db.execute(bets.insert().values(user_id=user_id, topic_id=topic_id, side=side, stake=stake, payout=0, created_at=receipt_time.isoformat())).inserted_primary_key[0]
    db.execute(ledger.insert().values(user_id=user_id, market_id=market["id"], bet_id=bet_id, amount=-stake, reason="bet", created_at=receipt_time.isoformat()))
    return {"id": bet_id, "receipt_time": receipt_time.isoformat(), "balance": balance(db, user_id)}
