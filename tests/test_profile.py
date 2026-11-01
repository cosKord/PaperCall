from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.api import create_app
from app.auth import create_user
from app.database import bets, connect, initialize, ledger, markets, topics
from app.views import profile_view


def seed_profile(path):
    initialize(path)
    now = datetime.now(timezone.utc)
    settled_at = now.isoformat()
    with connect(path, write=True) as db:
        alice = create_user(db, "alice@somaiya.edu", branch="CSE")
        bob = create_user(db, "bob@somaiya.edu", branch="IT")
        settled_market = db.execute(markets.insert().values(
            subject="FCOA", exam_type="midsem", starts_at=(now - timedelta(hours=3)).isoformat(),
            ends_at=(now - timedelta(hours=2)).isoformat(), lockout_at=(now - timedelta(hours=3)).isoformat(),
            grant_pts=100, home_branches=["CSE", "IT"], min_stake=1, away_min_stake=10,
            low_cap_pct=20, high_cap_pct=40, status="settled", settled_at=settled_at,
            legacy=False, review_needed=False,
        )).inserted_primary_key[0]
        active_market = db.execute(markets.insert().values(
            subject="OS", exam_type="endsem", starts_at=(now + timedelta(hours=2)).isoformat(),
            ends_at=(now + timedelta(hours=3)).isoformat(), lockout_at=(now + timedelta(hours=2)).isoformat(),
            grant_pts=150, home_branches=["CSE"], min_stake=1, away_min_stake=10,
            low_cap_pct=20, high_cap_pct=40, status="open", legacy=False, review_needed=False,
        )).inserted_primary_key[0]
        settled_topic = db.execute(topics.insert().values(market_id=settled_market, title="IAS", tier="low", outcome="hit")).inserted_primary_key[0]
        active_topic = db.execute(topics.insert().values(market_id=active_market, title="Deadlock", tier="high")).inserted_primary_key[0]
        alice_bet = db.execute(bets.insert().values(user_id=alice, topic_id=settled_topic, side="hit", stake=20, payout=40, created_at=(now - timedelta(hours=4)).isoformat())).inserted_primary_key[0]
        bob_bet = db.execute(bets.insert().values(user_id=bob, topic_id=settled_topic, side="miss", stake=10, payout=0, created_at=(now - timedelta(hours=4)).isoformat())).inserted_primary_key[0]
        active_bet = db.execute(bets.insert().values(user_id=alice, topic_id=active_topic, side="miss", stake=5, payout=0, created_at=now.isoformat())).inserted_primary_key[0]
        db.execute(ledger.insert(), [
            {"user_id": alice, "market_id": settled_market, "bet_id": None, "amount": 100, "reason": "grant", "created_at": settled_at},
            {"user_id": alice, "market_id": settled_market, "bet_id": alice_bet, "amount": -20, "reason": "stake", "created_at": settled_at},
            {"user_id": alice, "market_id": settled_market, "bet_id": alice_bet, "amount": 40, "reason": "payout", "created_at": settled_at},
            {"user_id": alice, "market_id": active_market, "bet_id": active_bet, "amount": -5, "reason": "stake", "created_at": now.isoformat()},
            {"user_id": bob, "market_id": settled_market, "bet_id": bob_bet, "amount": -10, "reason": "stake", "created_at": settled_at},
        ])
    return alice, settled_market, settled_topic, settled_at


def test_profile_view_is_caller_scoped_and_settled_only(tmp_path):
    path = tmp_path / "profile.db"
    alice, market_id, topic_id, settled_at = seed_profile(path)
    with connect(path) as db:
        assert profile_view(db, alice) == {
            "user": {"id": alice, "email": "alice@somaiya.edu", "branch": "CSE", "balance": 115},
            "score": 20,
            "rank": 1,
            "settled_bets": [{
                "market_id": market_id,
                "subject": "FCOA",
                "topic_id": topic_id,
                "topic": "IAS",
                "side": "hit",
                "stake": 20,
                "payout": 40,
                "net": 20,
                "outcome": "hit",
                "settled_at": settled_at,
            }],
        }


def test_profile_endpoint_requires_the_current_session(tmp_path):
    path = tmp_path / "profile_http.db"
    seed_profile(path)
    client = TestClient(create_app(path, mailer=lambda _: None, pilot_mode=True))
    assert client.get("/api/profile").status_code == 401
