from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
import pyotp

from market_app.api import create_app
from market_app.auth import create_user
from market_app.db import connect, initialize, login_codes, users
from market_app.markets import create_market


def test_login_and_private_market_response(tmp_path):
    path = tmp_path / "api.db"
    initialize(path)
    with connect(path, write=True) as db:
        admin = create_user(db, "admin@somaiya.edu", role="admin", branch="CSE")
        db.execute(users.update().where(users.c.id == admin).values(totp_secret="JBSWY3DPEHPK3PXP"))
        player = create_user(db, "alice@somaiya.edu", branch="CSE")
        starts = datetime.now(timezone.utc) + timedelta(hours=2)
        draft_id = create_market(db, admin, "Hidden draft", "midsem", starts, starts + timedelta(hours=1), ["CSE"], {"CSE": starts})
    sent = []
    app = create_app(path, mailer=sent.append, pilot_mode=True)
    client = TestClient(app)
    assert client.get("/api/markets").status_code == 401
    response = client.post("/api/auth/request-code", json={"email": "alice@somaiya.edu"})
    assert response.status_code == 200
    code = sent[-1].split()[-1]
    response = client.post("/api/auth/verify-code", json={"email": "alice@somaiya.edu", "code": code})
    assert response.status_code == 200
    assert response.cookies.get("session")
    assert "httponly" in response.headers["set-cookie"].lower()
    assert client.get("/api/me").json()["branch"] == "CSE"
    assert client.post("/api/bets", json={"topic_id": 1, "side": "hit", "stake": 1}).status_code == 403  # CSRF
    assert client.get("/api/markets").json() == []
    assert client.get(f"/api/markets/{draft_id}").status_code == 403


def test_admin_and_player_http_flow(tmp_path):
    path = tmp_path / "flow.db"
    initialize(path)
    secret = "JBSWY3DPEHPK3PXP"
    with connect(path, write=True) as db:
        admin = create_user(db, "admin@somaiya.edu", role="admin", branch="CSE")
        db.execute(users.update().where(users.c.id == admin).values(totp_secret=secret))
    sent = []
    app = create_app(path, mailer=sent.append, pilot_mode=True)
    admin_client = TestClient(app)
    admin_client.post("/api/auth/request-code", json={"email": "admin@somaiya.edu"})
    admin_client.post("/api/auth/verify-code", json={"email": "admin@somaiya.edu", "code": sent[-1].split()[-1]})
    headers = {"X-CSRF-Token": admin_client.cookies["csrf"]}
    starts = datetime.now(timezone.utc) + timedelta(hours=2)
    payload = {"subject": "FCOA", "exam_type": "midsem", "starts_at": starts.isoformat(), "ends_at": (starts+timedelta(hours=1)).isoformat(), "home_branches": ["CSE"], "branch_starts": {"CSE": starts.isoformat()}}
    assert admin_client.post("/api/admin/markets", json=payload, headers=headers).status_code == 403
    assert admin_client.post("/api/auth/admin-totp", json={"code": pyotp.TOTP(secret).now()}, headers=headers).status_code == 200
    market_id = admin_client.post("/api/admin/markets", json=payload, headers=headers).json()["id"]
    topic_id = admin_client.post(f"/api/admin/markets/{market_id}/topics", json={"title":"IAS machine", "tier":"low"}, headers=headers).json()["id"]
    assert admin_client.post(f"/api/admin/markets/{market_id}/publish", json={}, headers=headers).status_code == 200
    player_client = TestClient(app)
    player_client.post("/api/auth/request-code", json={"email": "alice@somaiya.edu"})
    player_client.post("/api/auth/verify-code", json={"email": "alice@somaiya.edu", "code": sent[-1].split()[-1]})
    player_id = player_client.get("/api/me").json()["id"]
    assert admin_client.post("/api/admin/branches", json={"user_id":player_id,"branch":"CSE"}, headers=headers).status_code == 200
    player_headers = {"X-CSRF-Token": player_client.cookies["csrf"]}
    assert player_client.post(f"/api/markets/{market_id}/claim-grant", json={}, headers=player_headers).json()["balance"] == 100
    assert player_client.post("/api/bets", json={"topic_id": topic_id, "side":"hit", "stake":20}, headers=player_headers).status_code == 200
    detail = player_client.get(f"/api/markets/{market_id}").json()
    assert "pool" not in detail["topics"][0]


def test_login_rate_limit_by_ip(tmp_path):
    app = create_app(tmp_path / "limit.db", mailer=lambda _: None, pilot_mode=True)
    client = TestClient(app)
    statuses = [client.post("/api/auth/request-code", json={"email": "x@gmail.com"}).status_code for _ in range(7)]
    assert statuses[-1] == 429


def test_invalid_code_attempt_is_persisted(tmp_path):
    path = tmp_path / "attempts.db"
    sent = []
    client = TestClient(create_app(path, mailer=sent.append, pilot_mode=True))
    assert client.post("/api/auth/request-code", json={"email": "alice@somaiya.edu"}).status_code == 200
    assert client.post("/api/auth/verify-code", json={"email": "alice@somaiya.edu", "code": "wrong"}).status_code == 400
    with connect(path) as db:
        assert db.execute(select(login_codes.c.attempts).where(login_codes.c.email == "alice@somaiya.edu")).scalar_one() == 1


def test_demo_code_is_loopback_only(tmp_path):
    client = TestClient(create_app(tmp_path / "loopback.db", pilot_mode=True))
    assert client.post("/api/auth/request-code", json={"email": "alice@somaiya.edu"}).status_code == 403


def test_admin_totp_attempts_are_limited(tmp_path):
    path = tmp_path / "totp_limit.db"
    initialize(path)
    with connect(path, write=True) as db:
        admin = create_user(db, "admin@somaiya.edu", role="admin")
        db.execute(users.update().where(users.c.id == admin).values(totp_secret="JBSWY3DPEHPK3PXP"))
    sent = []
    client = TestClient(create_app(path, mailer=sent.append, pilot_mode=True))
    client.post("/api/auth/request-code", json={"email": "admin@somaiya.edu"})
    client.post("/api/auth/verify-code", json={"email": "admin@somaiya.edu", "code": sent[-1].split()[-1]})
    headers = {"X-CSRF-Token": client.cookies["csrf"]}
    statuses = [client.post("/api/auth/admin-totp", json={"code": "000000"}, headers=headers).status_code for _ in range(6)]
    assert statuses == [403] * 5 + [429]


def test_production_requires_mail_and_otp_secret(tmp_path, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("OTP_SECRET", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    with pytest.raises(RuntimeError):
        create_app(tmp_path / "production.db", pilot_mode=False)
