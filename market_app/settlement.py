"""Question-paper evidence, payout preview, and final settlement."""
import hashlib
import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import delete, select

from .auth import require_admin
from .db import (audit_log, bets, db_now, ledger, markets,
                 settlement_previews, topics)


def attach_paper(db, admin_id, market_id, content, filename, upload_dir):
    require_admin(db, admin_id)
    market = db.execute(select(markets).where(markets.c.id == market_id)).mappings().first()
    if not market or market["status"] == "settled" or market["legacy"]:
        raise ValueError("Market cannot accept a paper")
    if not content or len(content) > 10 * 1024 * 1024 or not (content.startswith(b"%PDF-") or content.startswith(b"\x89PNG\r\n\x1a\n") or content.startswith(b"\xff\xd8\xff")):
        raise ValueError("Upload a PDF, PNG or JPEG up to 10 MB")
    suffix = ".pdf" if content.startswith(b"%PDF-") else ".png" if content.startswith(b"\x89PNG") else ".jpg"
    digest = hashlib.sha256(content).hexdigest()
    folder = Path(upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{market_id}-{digest}{suffix}"
    path.write_bytes(content)
    db.execute(markets.update().where(markets.c.id == market_id).values(paper_path=str(path), paper_hash=digest))
    db.execute(delete(settlement_previews).where(settlement_previews.c.market_id == market_id))
    db.execute(audit_log.insert().values(actor_id=admin_id, action="attach_paper", detail={"market_id": market_id, "hash": digest, "filename": filename}, created_at=db_now(db).isoformat()))
    return {"hash": digest, "name": filename}


def _calculate(db, market_id, outcomes):
    topic_rows = db.execute(select(topics).where(topics.c.market_id == market_id).order_by(topics.c.id)).mappings().all()
    if not topic_rows or {str(t["id"]) for t in topic_rows} != set(outcomes) or any(v not in ("hit", "miss", "void") for v in outcomes.values()):
        raise ValueError("Mark every topic hit, miss or void")
    payouts = {}
    for topic in topic_rows:
        rows = db.execute(select(bets).where(bets.c.topic_id == topic["id"]).order_by(bets.c.id)).mappings().all()
        pool = sum(b["stake"] for b in rows)
        winner_stakes = sum(b["stake"] for b in rows if b["side"] == outcomes[str(topic["id"])])
        for bet in rows:
            if outcomes[str(topic["id"])] == "void" or winner_stakes == 0:
                amount = bet["stake"]
                reason = "refund"
            elif bet["side"] == outcomes[str(topic["id"])]:
                amount = pool * bet["stake"] // winner_stakes
                reason = "payout"
            else:
                amount = 0
                reason = "payout"
            payouts[bet["id"]] = {"amount": amount, "reason": reason, "user_id": bet["user_id"]}
    return payouts


def preview_settlement(db, admin_id, market_id, outcomes):
    require_admin(db, admin_id)
    market = db.execute(select(markets).where(markets.c.id == market_id)).mappings().first()
    if not market or market["status"] in ("draft", "settled") or market["legacy"] or not market["paper_hash"] or not market["ends_at"] or db_now(db) < datetime.fromisoformat(market["ends_at"]):
        raise ValueError("Wait for exam end and attach its question paper")
    outcomes = {str(k): v for k, v in outcomes.items()}
    payouts = _calculate(db, market_id, outcomes)
    digest = hashlib.sha256(json.dumps({"market": market_id, "paper": market["paper_hash"], "outcomes": outcomes, "payouts": payouts}, sort_keys=True).encode()).hexdigest()
    existing = db.execute(select(settlement_previews.c.market_id).where(settlement_previews.c.market_id == market_id)).first()
    values = {"digest": digest, "outcomes": outcomes, "created_at": db_now(db).isoformat()}
    if existing:
        db.execute(settlement_previews.update().where(settlement_previews.c.market_id == market_id).values(**values))
    else:
        db.execute(settlement_previews.insert().values(market_id=market_id, **values))
    return {"digest": digest, "payout_total": sum(v["amount"] for v in payouts.values()), "payouts": payouts}


def confirm_settlement(db, admin_id, market_id, preview_digest):
    require_admin(db, admin_id)
    market = db.execute(select(markets).where(markets.c.id == market_id).with_for_update()).mappings().first()
    if not market:
        raise ValueError("Market not found")
    if market["status"] == "settled":
        if not db.execute(select(audit_log.c.id).where(audit_log.c.action == "settle", audit_log.c.detail["digest"].as_string() == preview_digest)).first():
            raise ValueError("Market already settled with a different preview")
        total = db.execute(select(bets.c.payout).join(topics, bets.c.topic_id == topics.c.id).where(topics.c.market_id == market_id)).scalars().all()
        return {"payout_total": sum(total), "status": "settled"}
    preview = db.execute(select(settlement_previews).where(settlement_previews.c.market_id == market_id)).mappings().first()
    if not preview or preview["digest"] != preview_digest:
        raise ValueError("Preview changed; review payouts again")
    payouts = _calculate(db, market_id, preview["outcomes"])
    current = hashlib.sha256(json.dumps({"market": market_id, "paper": market["paper_hash"], "outcomes": preview["outcomes"], "payouts": payouts}, sort_keys=True).encode()).hexdigest()
    if current != preview_digest:
        raise ValueError("Bets or paper changed; preview again")
    now = db_now(db).isoformat()
    for topic_id, outcome in preview["outcomes"].items():
        db.execute(topics.update().where(topics.c.id == int(topic_id)).values(outcome=outcome))
    for bet_id, payout in payouts.items():
        db.execute(bets.update().where(bets.c.id == bet_id).values(payout=payout["amount"]))
        if payout["amount"]:
            db.execute(ledger.insert().values(user_id=payout["user_id"], market_id=market_id, bet_id=bet_id, amount=payout["amount"], reason=payout["reason"], created_at=now))
    db.execute(markets.update().where(markets.c.id == market_id).values(status="settled", settled_at=now))
    db.execute(audit_log.insert().values(actor_id=admin_id, action="settle", detail={"market_id": market_id, "digest": preview_digest, "payout_total": sum(v["amount"] for v in payouts.values())}, created_at=now))
    return {"payout_total": sum(v["amount"] for v in payouts.values()), "status": "settled"}
