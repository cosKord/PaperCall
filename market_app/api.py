"""FastAPI routes; database credentials stay on the server."""
import hashlib
import os
import secrets
import ssl
import smtplib
import threading
import time
from email.message import EmailMessage
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from . import auth, betting, markets as market_rules, settlement, views
from .db import (balance, branch_exams, connect, db_now, initialize, markets,
                 sessions, topics, users)

ROOT = Path(__file__).resolve().parents[1]


class EmailInput(BaseModel):
    email: str


class CodeInput(EmailInput):
    code: str


class TOTPInput(BaseModel):
    code: str


class BranchInput(BaseModel):
    user_id: int
    branch: str


class MarketInput(BaseModel):
    subject: str
    exam_type: str
    starts_at: __import__("datetime").datetime
    ends_at: __import__("datetime").datetime
    home_branches: list[str]
    branch_starts: dict[str, __import__("datetime").datetime]
    grant_pts: int | None = None
    min_stake: int = 1
    away_min_stake: int = 10
    low_cap_pct: int = 20
    high_cap_pct: int = 40


class TopicInput(BaseModel):
    title: str
    tier: str


class BetInput(BaseModel):
    topic_id: int
    side: str
    stake: int


class OutcomesInput(BaseModel):
    outcomes: dict[int, str]


class ConfirmInput(BaseModel):
    digest: str


def smtp_mailer(email, message):
    host = os.environ.get("SMTP_HOST")
    sender = os.environ.get("SMTP_FROM")
    if not host or not sender:
        raise RuntimeError("SMTP_HOST and SMTP_FROM must be configured")
    mail = EmailMessage()
    mail["From"] = sender
    mail["To"] = email
    mail["Subject"] = "Exam Prediction login code"
    mail.set_content(message)
    with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=10) as server:
        server.starttls(context=ssl.create_default_context())
        if os.environ.get("SMTP_USERNAME"):
            server.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
        server.send_message(mail)


def create_app(path=None, mailer=None, pilot_mode=False):
    if os.environ.get("APP_ENV") == "production":
        if pilot_mode or not all(os.environ.get(key) for key in ("OTP_SECRET", "SMTP_HOST", "SMTP_FROM", "SMTP_USERNAME", "SMTP_PASSWORD")):
            raise RuntimeError("Production requires SMTP and OTP_SECRET; PILOT_MODE must be off")
    initialize(path)
    app = FastAPI(title="Exam Prediction Market")
    upload_dir = Path(os.environ.get("UPLOAD_DIR", ROOT / "uploads"))
    attempts = {}
    attempts_lock = threading.Lock()

    def limit(request, key, allowed, window=60):
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        identity = f"{key}:{ip}"
        with attempts_lock:
            recent = [t for t in attempts.get(identity, []) if now - t < window]
            if len(recent) >= allowed:
                raise HTTPException(429, "Too many requests; try again later")
            recent.append(now)
            attempts[identity] = recent

    def user_from(request, db):
        try:
            return auth.current_user(db, request.cookies.get("session"))
        except PermissionError as exc:
            raise HTTPException(401, str(exc))

    def admin_from(request, db):
        user_id = user_from(request, db)
        try:
            auth.require_admin(db, user_id, request.cookies.get("session"))
            return user_id
        except PermissionError as exc:
            raise HTTPException(403, str(exc))

    def csrf(request):
        cookie = request.cookies.get("csrf")
        header = request.headers.get("X-CSRF-Token")
        if not cookie or not header or not secrets.compare_digest(cookie, header):
            raise HTTPException(403, "CSRF token required")

    @app.exception_handler(ValueError)
    async def value_error(_, exc):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(PermissionError)
    async def permission_error(_, exc):
        return JSONResponse(status_code=403, content={"detail": str(exc)})

    @app.get("/")
    def index():
        return FileResponse(ROOT / "index.html")

    @app.get("/{asset_name}")
    def asset(asset_name: str):
        if asset_name not in ("ui.js", "style.css", "pilot.js", "pilot.css"):
            raise HTTPException(404)
        return FileResponse(ROOT / asset_name)

    @app.get("/api/time")
    def time_route():
        with connect(path) as db:
            return {"now": db_now(db).isoformat()}

    @app.post("/api/auth/request-code")
    def request_code_route(request: Request, body: EmailInput):
        limit(request, "request_code", 6)
        if pilot_mode and mailer is None and (not request.client or request.client.host not in ("127.0.0.1", "::1")):
            raise HTTPException(403, "Local demo codes require a loopback connection")
        messages = []
        send = (lambda message: mailer(message)) if mailer else (lambda message: messages.append(message) if pilot_mode else smtp_mailer(body.email, message))
        with connect(path, write=True) as db:
            auth.request_code(db, body.email, send)
        response = {"ok": True}
        if pilot_mode and not mailer:
            response["demo_code"] = messages[-1].split()[-1]
        return response

    @app.post("/api/auth/verify-code")
    def verify_code_route(request: Request, body: CodeInput):
        limit(request, f"verify_code:{body.email.lower()}", 5, 600)
        invalid = None
        with connect(path, write=True) as db:
            try:
                session = auth.verify_code(db, body.email, body.code)
            except ValueError as exc:
                invalid = exc
        if invalid:
            raise invalid
        response = JSONResponse({"ok": True})
        secure = not pilot_mode
        response.set_cookie("session", session.token, httponly=True, secure=secure, samesite="strict", max_age=7 * 86400)
        response.set_cookie("csrf", secrets.token_urlsafe(24), httponly=False, secure=secure, samesite="strict", max_age=7 * 86400)
        return response

    @app.post("/api/auth/admin-totp")
    def admin_totp_route(request: Request, body: TOTPInput):
        csrf(request)
        limit(request, f"admin_totp:{request.cookies.get('session', '')[:12]}", 5, 600)
        with connect(path, write=True) as db:
            user_id = user_from(request, db)
            auth.verify_admin_totp(db, user_id, request.cookies.get("session"), body.code)
        return {"ok": True}

    @app.post("/api/auth/logout")
    def logout_route(request: Request):
        csrf(request)
        token = request.cookies.get("session")
        if token:
            with connect(path, write=True) as db:
                db.execute(sessions.delete().where(sessions.c.token_hash == hashlib.sha256(token.encode()).hexdigest()))
        response = JSONResponse({"ok": True})
        response.delete_cookie("session")
        response.delete_cookie("csrf")
        return response

    @app.get("/api/me")
    def me(request: Request):
        with connect(path) as db:
            user_id = user_from(request, db)
            user = db.execute(select(users).where(users.c.id == user_id)).mappings().one()
            return {"id": user_id, "email": user["email"] or user["username"], "role": user["role"], "branch": user["branch"], "balance": balance(db, user_id), "admin_verified": bool(db.execute(select(sessions.c.admin_verified).where(sessions.c.token_hash == hashlib.sha256(request.cookies["session"].encode()).hexdigest())).scalar_one())}

    @app.get("/api/markets")
    def market_list(request: Request):
        with connect(path) as db:
            user_id = user_from(request, db)
            role = db.execute(select(users.c.role).where(users.c.id == user_id)).scalar_one()
            query = select(markets.c.id, markets.c.subject, markets.c.exam_type, markets.c.lockout_at, markets.c.status).order_by(markets.c.id.desc())
            if role != "admin":
                query = query.where(markets.c.status != "draft", markets.c.legacy == False)
            return [dict(row) for row in db.execute(query).mappings()]

    @app.get("/api/markets/{market_id}")
    def market_detail(request: Request, market_id: int):
        with connect(path) as db:
            return views.market_view(db, user_from(request, db), market_id)

    @app.post("/api/markets/{market_id}/claim-grant")
    def grant(request: Request, market_id: int):
        csrf(request)
        with connect(path, write=True) as db:
            user_id = user_from(request, db)
            return {"grant": market_rules.claim_grant(db, user_id, market_id), "balance": balance(db, user_id)}

    @app.post("/api/bets")
    def bet(request: Request, body: BetInput):
        csrf(request)
        limit(request, f"bet:{request.cookies.get('session','')[:12]}", 30)
        with connect(path, write=True) as db:
            return betting.place_bet(db, user_from(request, db), body.topic_id, body.side, body.stake)

    @app.get("/api/leaderboard")
    def leaderboard_route(request: Request, scope: str = "season", market_id: int | None = None):
        with connect(path) as db:
            user_from(request, db)
            return views.leaderboard(db, scope, market_id)

    @app.post("/api/admin/branches")
    def assign_branch_route(request: Request, body: BranchInput):
        csrf(request)
        with connect(path, write=True) as db:
            auth.assign_branch(db, admin_from(request, db), body.user_id, body.branch)
        return {"ok": True}

    @app.get("/api/admin/users")
    def admin_users(request: Request):
        with connect(path) as db:
            admin_from(request, db)
            return [dict(row) for row in db.execute(select(users.c.id, users.c.email, users.c.branch, users.c.role).where(users.c.active == True)).mappings()]

    @app.post("/api/admin/markets")
    def create_market_route(request: Request, body: MarketInput):
        csrf(request)
        with connect(path, write=True) as db:
            market_id = market_rules.create_market(db, admin_from(request, db), **body.model_dump())
        return {"id": market_id}

    @app.post("/api/admin/markets/{market_id}/topics")
    def add_topic_route(request: Request, market_id: int, body: TopicInput):
        csrf(request)
        with connect(path, write=True) as db:
            return {"id": market_rules.add_topic(db, admin_from(request, db), market_id, body.title, body.tier)}

    @app.post("/api/admin/markets/{market_id}/publish")
    def publish_route(request: Request, market_id: int):
        csrf(request)
        with connect(path, write=True) as db:
            market_rules.publish_market(db, admin_from(request, db), market_id)
        return {"ok": True}

    @app.post("/api/admin/markets/{market_id}/paper")
    async def paper_upload(request: Request, market_id: int, file: UploadFile = File(...)):
        csrf(request)
        content = await file.read(10 * 1024 * 1024 + 1)
        with connect(path, write=True) as db:
            return settlement.attach_paper(db, admin_from(request, db), market_id, content, file.filename or "paper", upload_dir)

    @app.post("/api/admin/markets/{market_id}/settlement-preview")
    def preview_route(request: Request, market_id: int, body: OutcomesInput):
        csrf(request)
        with connect(path, write=True) as db:
            return settlement.preview_settlement(db, admin_from(request, db), market_id, body.outcomes)

    @app.post("/api/admin/markets/{market_id}/settle")
    def settle_route(request: Request, market_id: int, body: ConfirmInput):
        csrf(request)
        with connect(path, write=True) as db:
            return settlement.confirm_settlement(db, admin_from(request, db), market_id, body.digest)

    @app.get("/api/markets/{market_id}/paper")
    def published_paper(request: Request, market_id: int):
        with connect(path) as db:
            user_from(request, db)
            market = db.execute(select(markets).where(markets.c.id == market_id)).mappings().first()
            if not market or market["status"] != "settled" or not market["paper_path"]:
                raise HTTPException(404)
            return FileResponse(market["paper_path"])

    return app


app = create_app(pilot_mode=os.environ.get("PILOT_MODE") == "1")
