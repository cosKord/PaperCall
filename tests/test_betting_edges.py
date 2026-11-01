from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.auth import create_user
from app.betting import BetError, place_bet
from app.database import balance, bets, connect, initialize, ledger, markets, topics
from app.markets import add_topic, claim_grant, create_market, market_phase, publish_market


def test_exact_cutoff_and_parallel_requests_cannot_overspend(tmp_path):
    path = tmp_path / "race.db"
    initialize(path)
    start = datetime.now(timezone.utc) + timedelta(hours=2)
    with connect(path, write=True) as db:
        admin = create_user(db, "admin@somaiya.edu", "admin", "CSE")
        player = create_user(db, "player@somaiya.edu", branch="CSE")
        market_id = create_market(db, admin, "FCOA", "midsem", start, start + timedelta(hours=1), ["CSE"], {"CSE": start}, low_cap_pct=100)
        topic_ids = [add_topic(db, admin, market_id, f"Topic {i}", "low") for i in range(20)]
        publish_market(db, admin, market_id)
        claim_grant(db, player, market_id)
        cutoff = datetime.fromisoformat(db.execute(select(markets.c.lockout_at).where(markets.c.id == market_id)).scalar_one())
        assert market_phase(db, market_id, cutoff - timedelta(microseconds=1)) == "open"
        assert market_phase(db, market_id, cutoff) == "closed"

    def submit(topic_id):
        try:
            with connect(path, write=True) as db:
                place_bet(db, player, topic_id, "hit", 100)
            return True
        except BetError:
            return False

    with ThreadPoolExecutor(max_workers=20) as executor:
        accepted = list(executor.map(submit, topic_ids))
    assert accepted.count(True) == 1
    with connect(path) as db:
        assert balance(db, player) == 0
        assert len(db.execute(select(bets)).all()) == 1
        assert len(db.execute(select(ledger).where(ledger.c.reason == "bet")).all()) == 1


def test_unscheduled_branch_cannot_bet_without_exam_time(tmp_path):
    path = tmp_path / "branch.db"
    initialize(path)
    start = datetime.now(timezone.utc) + timedelta(hours=2)
    with connect(path, write=True) as db:
        admin = create_user(db, "admin@somaiya.edu", "admin", "CSE")
        outsider = create_user(db, "outsider@somaiya.edu", branch="MECH")
        market_id = create_market(db, admin, "FCOA", "midsem", start, start + timedelta(hours=1), ["CSE"], {"CSE": start})
        topic_id = add_topic(db, admin, market_id, "IAS", "low")
        publish_market(db, admin, market_id)
        try:
            claim_grant(db, outsider, market_id)
        except ValueError:
            pass
        else:
            assert False, "unknown branch exam schedule must not receive a grant"
        try:
            place_bet(db, outsider, topic_id, "hit", 10)
        except BetError:
            pass
        else:
            assert False, "unknown branch exam schedule must be rejected"
