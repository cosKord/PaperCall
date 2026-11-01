from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.database import (balance, connect, initialize, ledger, markets,
                          topics, users)
from app.auth import create_user, request_code, verify_code, assign_branch
from app.markets import create_market, add_topic, publish_market, claim_grant
from app.betting import place_bet, BetError
from app.settlement import attach_paper, preview_settlement, confirm_settlement
from app.views import leaderboard, market_view


def setup_users(path):
    initialize(path)
    with connect(path, write=True) as db:
        admin = create_user(db, "admin@somaiya.edu", role="admin", branch="CSE")
        alice = create_user(db, "alice@somaiya.edu")
        bob = create_user(db, "bob@somaiya.edu")
        assign_branch(db, admin, alice, "CSE")
        assign_branch(db, admin, bob, "IT")
    return admin, alice, bob


def test_email_code_is_one_time_and_domain_restricted(tmp_path):
    path = tmp_path / "pilot.db"
    initialize(path)
    sent = []
    with connect(path, write=True) as db:
        with pytest.raises(ValueError):
            request_code(db, "x@gmail.com", sent.append)
        with pytest.raises(ValueError):
            request_code(db, "@somaiya.edu", sent.append)
        request_code(db, "new@somaiya.edu", sent.append)
    assert len(sent) == 1
    code = sent[0].split()[-1]
    with connect(path, write=True) as db:
        session = verify_code(db, "new@somaiya.edu", code)
        assert session.token
        with pytest.raises(ValueError):
            verify_code(db, "new@somaiya.edu", code)


def test_market_end_covers_every_branch_and_home_branch_is_scheduled(tmp_path):
    path = tmp_path / "schedule.db"
    admin, _, _ = setup_users(path)
    starts = datetime.now(timezone.utc) + timedelta(hours=2)
    with connect(path, write=True) as db:
        with pytest.raises(ValueError):
            create_market(db, admin, "FCOA", "midsem", starts, starts + timedelta(hours=1), ["CSE"], {"CSE": starts, "IT": starts + timedelta(hours=2)})
        with pytest.raises(ValueError):
            create_market(db, admin, "FCOA", "midsem", starts, starts + timedelta(hours=3), ["MECH"], {"CSE": starts})


def test_market_can_open_ten_minutes_before_exam_and_locks_at_start(tmp_path):
    path = tmp_path / "short_notice.db"
    admin, _, _ = setup_users(path)
    starts = datetime.now(timezone.utc) + timedelta(minutes=10)
    with connect(path, write=True) as db:
        market_id = create_market(db, admin, "FCOA", "midsem", starts, starts + timedelta(hours=1), ["CSE"], {"CSE": starts})
        lockout = db.execute(select(markets.c.lockout_at).where(markets.c.id == market_id)).scalar_one()
        assert datetime.fromisoformat(lockout) == starts


def test_market_grant_bet_and_settlement_preserve_negative_score(tmp_path):
    path = tmp_path / "pilot.db"
    admin, alice, bob = setup_users(path)
    starts = datetime.now(timezone.utc) + timedelta(hours=2)
    ends = starts + timedelta(hours=2)
    with connect(path, write=True) as db:
        market_id = create_market(db, admin, "FCOA", "midsem", starts, ends, ["CSE"], {"CSE": starts, "IT": starts + timedelta(minutes=10)})
        topic_id = add_topic(db, admin, market_id, "IAS machine", "low")
        publish_market(db, admin, market_id)
        assert claim_grant(db, alice, market_id) == 100
        assert claim_grant(db, alice, market_id) == 100
        assert claim_grant(db, bob, market_id) == 100
        assert balance(db, alice) == 100
        assert balance(db, bob) == 100
    with connect(path, write=True) as db:
        place_bet(db, alice, topic_id, "hit", 20)
        place_bet(db, bob, topic_id, "miss", 20)
        with pytest.raises(BetError):
            place_bet(db, alice, topic_id, "miss", 1)
        assert "pool" not in market_view(db, bob, market_id)["topics"][0]
        assert balance(db, alice) == 80
        assert balance(db, bob) == 80
        db.execute(markets.update().where(markets.c.id == market_id).values(ends_at=(datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()))
        attach_paper(db, admin, market_id, b"%PDF-1.4\nexam paper", "paper.pdf", tmp_path / "uploads")
        preview = preview_settlement(db, admin, market_id, {topic_id: "hit"})
        result = confirm_settlement(db, admin, market_id, preview["digest"])
        assert result["payout_total"] == 40
        assert confirm_settlement(db, admin, market_id, preview["digest"]) == result
        assert balance(db, alice) == 120
        assert balance(db, bob) == 80
        assert {r["email"]: r["score"] for r in leaderboard(db, "season")} == {"alice@somaiya.edu": 20, "bob@somaiya.edu": -20}
        assert market_view(db, bob, market_id)["topics"][0]["pool"] == {"hit": 20, "miss": 20}
        assert db.execute(select(ledger).where(ledger.c.reason == "payout")).fetchall().__len__() == 1
