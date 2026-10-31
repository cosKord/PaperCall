"""Verified email login, sessions, and admin-managed branch identity."""
import hashlib
import hmac
import os
import secrets
from dataclasses import dataclass
from datetime import timedelta

import pyotp
from sqlalchemy import select

from .db import audit_log, db_now, login_codes, sessions, users


@dataclass(frozen=True)
class Session:
    token: str
    user_id: int


def create_user(db, email, role="player", branch=None):
    email = email.strip().lower()
    if not _valid_college_email(email):
        raise ValueError("College email required")
    row = db.execute(select(users.c.id).where(users.c.email == email)).first()
    if row:
        return row[0]
    return db.execute(users.insert().values(email=email, role=role, branch=branch, active=True, created_at=db_now(db).isoformat())).inserted_primary_key[0]


def require_admin(db, user_id, session_token=None):
    row = db.execute(select(users).where(users.c.id == user_id)).mappings().first()
    if not row or row["role"] != "admin" or not row["active"]:
        raise PermissionError("Admin access required")
    if session_token is not None:
        token_hash = hashlib.sha256(session_token.encode()).hexdigest()
        session = db.execute(select(sessions).where(sessions.c.token_hash == token_hash)).mappings().first()
        if not session or not session["admin_verified"]:
            raise PermissionError("Admin second factor required")


def assign_branch(db, admin_id, user_id, branch):
    require_admin(db, admin_id)
    if not branch or len(branch) > 80:
        raise ValueError("Valid branch required")
    if db.execute(users.update().where(users.c.id == user_id).values(branch=branch)).rowcount != 1:
        raise ValueError("User not found")
    db.execute(audit_log.insert().values(actor_id=admin_id, action="assign_branch", detail={"user_id": user_id, "branch": branch}, created_at=db_now(db).isoformat()))


def _code_hash(email, code):
    secret = os.environ.get("OTP_SECRET", "local-demo-only")
    return hmac.new(secret.encode(), f"{email}:{code}".encode(), "sha256").hexdigest()


def _valid_college_email(email):
    local, sep, domain = email.partition("@")
    return bool(local and sep and domain == "somaiya.edu" and "@" not in local and not any(ch.isspace() for ch in email))


def request_code(db, email, send):
    email = email.strip().lower()
    if not _valid_college_email(email):
        raise ValueError("College email required")
    current = db_now(db)
    existing = db.execute(select(login_codes).where(login_codes.c.email == email)).mappings().first()
    if existing and (current - __import__("datetime").datetime.fromisoformat(existing["last_sent_at"])).total_seconds() < 60:
        raise ValueError("Please wait before requesting another code")
    code = f"{secrets.randbelow(1000000):06d}"
    values = {"email": email, "code_hash": _code_hash(email, code), "expires_at": (current + timedelta(minutes=10)).isoformat(), "attempts": 0, "last_sent_at": current.isoformat()}
    if existing:
        db.execute(login_codes.update().where(login_codes.c.email == email).values(**values))
    else:
        db.execute(login_codes.insert().values(**values))
    send(f"Your Exam Prediction code is {code}")


def verify_code(db, email, code):
    email = email.strip().lower()
    row = db.execute(select(login_codes).where(login_codes.c.email == email)).mappings().first()
    current = db_now(db)
    if not row or row["attempts"] >= 5 or current.isoformat() >= row["expires_at"] or not hmac.compare_digest(row["code_hash"], _code_hash(email, code)):
        if row:
            db.execute(login_codes.update().where(login_codes.c.email == email).values(attempts=row["attempts"] + 1))
        raise ValueError("Invalid or expired code")
    db.execute(login_codes.delete().where(login_codes.c.email == email))
    user_id = create_user(db, email)
    token = secrets.token_urlsafe(32)
    db.execute(sessions.insert().values(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=user_id, expires_at=(current + timedelta(days=7)).isoformat(), admin_verified=False))
    return Session(token, user_id)


def current_user(db, token):
    if not token:
        raise PermissionError("Login required")
    row = db.execute(select(sessions.c.user_id, sessions.c.expires_at).where(sessions.c.token_hash == hashlib.sha256(token.encode()).hexdigest())).first()
    if not row or row.expires_at <= db_now(db).isoformat():
        raise PermissionError("Session expired")
    return row.user_id


def verify_admin_totp(db, user_id, token, code):
    require_admin(db, user_id)
    row = db.execute(select(users.c.totp_secret).where(users.c.id == user_id)).first()
    if not row or not row.totp_secret or not pyotp.TOTP(row.totp_secret).verify(code, valid_window=1):
        raise PermissionError("Invalid admin code")
    _mark_admin_verified(db, user_id, token)


def verify_admin_pilot_code(db, user_id, token, code, configured_code):
    require_admin(db, user_id)
    if not hmac.compare_digest(str(code), configured_code):
        raise PermissionError("Invalid admin code")
    _mark_admin_verified(db, user_id, token)


def _mark_admin_verified(db, user_id, token):
    db.execute(sessions.update().where(sessions.c.token_hash == hashlib.sha256(token.encode()).hexdigest(), sessions.c.user_id == user_id).values(admin_verified=True))
