"""Caller-safe views and settled-only rankings."""
from sqlalchemy import select

from .database import balance, bets, markets, topics, users
from .markets import market_phase


def market_view(db, user_id, market_id):
    market = db.execute(select(markets).where(markets.c.id == market_id)).mappings().first()
    if not market:
        raise ValueError("Market not found")
    role = db.execute(select(users.c.role).where(users.c.id == user_id)).scalar_one_or_none()
    if role != "admin" and (market["status"] == "draft" or market["legacy"]):
        raise PermissionError("Market unavailable")
    result = {"id": market_id, "subject": market["subject"], "exam_type": market["exam_type"], "starts_at": market["starts_at"], "ends_at": market["ends_at"], "lockout_at": market["lockout_at"], "status": market_phase(db, market_id), "grant_pts": market["grant_pts"], "legacy": bool(market["legacy"]), "topics": []}
    if market["status"] == "settled":
        result["paper_available"] = bool(market["paper_path"])
    for topic in db.execute(select(topics).where(topics.c.market_id == market_id).order_by(topics.c.id)).mappings():
        item = {"id": topic["id"], "title": topic["title"], "tier": topic["tier"]}
        own = db.execute(select(bets).where(bets.c.topic_id == topic["id"], bets.c.user_id == user_id)).mappings().first()
        if own:
            item["my_bet"] = {"side": own["side"], "stake": own["stake"]}
            if market["status"] == "settled":
                item["my_bet"].update(payout=own["payout"], net=own["payout"] - own["stake"])
        if market["status"] == "settled":
            item["outcome"] = topic["outcome"]
            rows = db.execute(select(bets.c.side, bets.c.stake).where(bets.c.topic_id == topic["id"])).all()
            item["pool"] = {"hit": sum(r.stake for r in rows if r.side == "hit"), "miss": sum(r.stake for r in rows if r.side == "miss")}
        result["topics"].append(item)
    return result


def leaderboard(db, scope="season", market_id=None):
    if scope not in ("season", "market") or (scope == "market" and market_id is None):
        raise ValueError("Choose season or market scope")
    rows = []
    for user in db.execute(select(users).where(users.c.role == "player").order_by(users.c.id)).mappings():
        query = select(bets.c.stake, bets.c.payout).join(topics, bets.c.topic_id == topics.c.id).join(markets, topics.c.market_id == markets.c.id).where(bets.c.user_id == user["id"], markets.c.status == "settled")
        if scope == "market":
            query = query.where(markets.c.id == market_id)
        records = db.execute(query).all()
        rows.append({"email": user["email"] or user["username"], "score": sum(r.payout - r.stake for r in records)})
    return sorted(rows, key=lambda r: (-r["score"], r["email"]))


def profile_view(db, user_id):
    user = db.execute(select(users).where(users.c.id == user_id)).mappings().first()
    if not user:
        raise ValueError("User not found")

    settled = db.execute(
        select(
            bets.c.id,
            markets.c.id.label("market_id"),
            markets.c.subject,
            markets.c.settled_at,
            topics.c.id.label("topic_id"),
            topics.c.title.label("topic"),
            topics.c.outcome,
            bets.c.side,
            bets.c.stake,
            bets.c.payout,
        )
        .select_from(bets.join(topics, bets.c.topic_id == topics.c.id).join(markets, topics.c.market_id == markets.c.id))
        .where(bets.c.user_id == user_id, markets.c.status == "settled")
        .order_by(markets.c.settled_at.desc(), bets.c.id.desc())
    ).mappings().all()
    email = user["email"] or user["username"]
    rankings = leaderboard(db)
    rank = next((index for index, row in enumerate(rankings, start=1) if row["email"] == email), 0)

    return {
        "user": {"id": user_id, "email": email, "branch": user["branch"], "balance": balance(db, user_id)},
        "score": sum(row["payout"] - row["stake"] for row in settled),
        "rank": rank,
        "settled_bets": [
            {
                "market_id": row["market_id"],
                "subject": row["subject"],
                "topic_id": row["topic_id"],
                "topic": row["topic"],
                "side": row["side"],
                "stake": row["stake"],
                "payout": row["payout"],
                "net": row["payout"] - row["stake"],
                "outcome": row["outcome"],
                "settled_at": row["settled_at"],
            }
            for row in settled
        ],
    }
