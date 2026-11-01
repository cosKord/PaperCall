from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.auth import create_user
from app.betting import place_bet
from app.database import balance, connect, initialize, markets, topics
from app.markets import add_topic, claim_grant, create_market, publish_market
from app.settlement import attach_paper, confirm_settlement, preview_settlement


def test_void_refunds_and_floor_rounding_discards_fraction(tmp_path):
    path = tmp_path / "settle.db"
    initialize(path)
    start = datetime.now(timezone.utc) + timedelta(hours=2)
    with connect(path, write=True) as db:
        admin = create_user(db, "admin@somaiya.edu", "admin", "CSE")
        players = [create_user(db, f"p{i}@somaiya.edu", branch="CSE") for i in range(4)]
        market_id = create_market(db, admin, "FCOA", "midsem", start, start + timedelta(hours=1), ["CSE"], {"CSE":start})
        rounded = add_topic(db, admin, market_id, "IAS", "low")
        voided = add_topic(db, admin, market_id, "Dropped", "low")
        publish_market(db, admin, market_id)
        for player in players:
            claim_grant(db, player, market_id)
        for player in players[:3]:
            place_bet(db, player, rounded, "hit", 1)
        place_bet(db, players[3], rounded, "miss", 1)
        place_bet(db, players[3], voided, "hit", 1)
        db.execute(markets.update().where(markets.c.id == market_id).values(ends_at=(datetime.now(timezone.utc)-timedelta(minutes=1)).isoformat()))
        attach_paper(db, admin, market_id, b"%PDF-1.4\nexam paper", "paper.pdf", tmp_path / "uploads")
        preview = preview_settlement(db, admin, market_id, {rounded:"hit",voided:"void"})
        assert preview["payout_total"] == 4  # pool 4 rounds down to 3; void refunds 1
        confirm_settlement(db, admin, market_id, preview["digest"])
        assert [balance(db,p) for p in players] == [100,100,100,99]
        assert db.execute(select(topics.c.outcome).where(topics.c.id == voided)).scalar_one() == "void"
