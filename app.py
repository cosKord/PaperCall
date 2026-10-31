"""Dependency-free exam prediction prototype. Run: python app.py"""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "exams.db"


class RuleError(Exception):
    pass


def now():
    return datetime.now(timezone.utc)


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 180000)
    return salt + ":" + digest.hex()


def password_matches(password, stored):
    salt, expected = stored.split(":", 1)
    return hmac.compare_digest(password_hash(password, salt), stored)


class Store:
    def __init__(self, path=DB_PATH):
        self.path = path

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def initialize(self):
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 1000);
                CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY, title TEXT NOT NULL, starts_at TEXT NOT NULL, locked INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS markets (id INTEGER PRIMARY KEY, exam_id INTEGER NOT NULL REFERENCES exams(id), kind TEXT NOT NULL, prompt TEXT NOT NULL, result TEXT, settlement TEXT);
                CREATE TABLE IF NOT EXISTS bets (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), market_id INTEGER NOT NULL REFERENCES markets(id), side TEXT NOT NULL, stake INTEGER NOT NULL, payout INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
            """)
            for username, password, role in (("admin", "admin123", "admin"), ("alice", "player123", "player"), ("bob", "player123", "player")):
                db.execute("INSERT OR IGNORE INTO users(username,password,role) VALUES(?,?,?)", (username, password_hash(password), role))

    def authenticate(self, username, password):
        with self.connect() as db:
            user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
            if not user or not password_matches(password, user["password"]):
                raise RuleError("Invalid username or password")
            return user["id"]

    def create_session(self, user_id):
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute("INSERT INTO sessions VALUES(?,?,?)", (token, user_id, now().isoformat()))
        return token

    def session_user(self, token):
        if not token:
            return None
        with self.connect() as db:
            row = db.execute("SELECT user_id FROM sessions WHERE token=?", (token,)).fetchone()
            return row["user_id"] if row else None

    def logout(self, token):
        with self.connect() as db:
            db.execute("DELETE FROM sessions WHERE token=?", (token,))

    def _role(self, db, user_id):
        row = db.execute("SELECT role FROM users WHERE id=?", (user_id,)).fetchone()
        if not row:
            raise RuleError("Please log in")
        return row["role"]

    def _admin(self, db, user_id):
        if self._role(db, user_id) != "admin":
            raise RuleError("Admin access required")

    def balance(self, user_id):
        with self.connect() as db:
            return db.execute("SELECT balance FROM users WHERE id=?", (user_id,)).fetchone()[0]

    def create_exam(self, user_id, title, starts_at):
        title = str(title).strip()
        try:
            start = datetime.fromisoformat(starts_at.replace("Z", "+00:00"))
            if start.tzinfo is None or start.astimezone(timezone.utc) <= now():
                raise ValueError()
        except (ValueError, AttributeError):
            raise RuleError("Choose a future exam start with a timezone")
        if not title or len(title) > 120:
            raise RuleError("Exam title must be 1–120 characters")
        with self.connect() as db:
            self._admin(db, user_id)
            return db.execute("INSERT INTO exams(title,starts_at) VALUES(?,?)", (title, start.astimezone(timezone.utc).isoformat())).lastrowid

    def create_market(self, user_id, exam_id, kind, prompt):
        prompt = str(prompt).strip()
        if kind not in ("topic", "question") or not prompt or len(prompt) > 240:
            raise RuleError("Choose a market type and a prompt under 240 characters")
        with self.connect() as db:
            self._admin(db, user_id)
            exam = db.execute("SELECT * FROM exams WHERE id=?", (exam_id,)).fetchone()
            if not exam or exam["locked"] or datetime.fromisoformat(exam["starts_at"]) <= now():
                raise RuleError("Exam is closed or missing")
            return db.execute("INSERT INTO markets(exam_id,kind,prompt) VALUES(?,?,?)", (exam_id, kind, prompt)).lastrowid

    def place_bet(self, user_id, market_id, side, stake):
        if type(stake) is not int or stake < 1:
            raise RuleError("Stake must be a positive whole number")
        if side not in ("YES", "NO"):
            raise RuleError("Choose YES or NO")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if self._role(db, user_id) != "player":
                raise RuleError("Only players can place bets")
            market = db.execute("SELECT m.result,e.locked,e.starts_at FROM markets m JOIN exams e ON e.id=m.exam_id WHERE m.id=?", (market_id,)).fetchone()
            if not market or market["result"] or market["locked"] or datetime.fromisoformat(market["starts_at"]) <= now():
                raise RuleError("Betting is closed")
            if db.execute("SELECT balance FROM users WHERE id=?", (user_id,)).fetchone()[0] < stake:
                raise RuleError("Not enough points")
            db.execute("UPDATE users SET balance=balance-? WHERE id=?", (stake, user_id))
            return db.execute("INSERT INTO bets(user_id,market_id,side,stake,created_at) VALUES(?,?,?,?,?)", (user_id, market_id, side, stake, now().isoformat())).lastrowid

    def lock_exam(self, user_id, exam_id):
        with self.connect() as db:
            self._admin(db, user_id)
            if db.execute("UPDATE exams SET locked=1 WHERE id=?", (exam_id,)).rowcount != 1:
                raise RuleError("Exam not found")

    def settle_market(self, user_id, market_id, result):
        if result not in ("YES", "NO"):
            raise RuleError("Result must be YES or NO")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            self._admin(db, user_id)
            market = db.execute("SELECT m.*,e.locked,e.starts_at FROM markets m JOIN exams e ON e.id=m.exam_id WHERE m.id=?", (market_id,)).fetchone()
            if not market:
                raise RuleError("Market not found")
            if market["result"]:
                raise RuleError("Market already settled")
            if datetime.fromisoformat(market["starts_at"]) > now():
                raise RuleError("Wait until the exam starts to settle")
            bets = db.execute("SELECT * FROM bets WHERE market_id=? ORDER BY id", (market_id,)).fetchall()
            pool = sum(b["stake"] for b in bets)
            winners = [b for b in bets if b["side"] == result]
            winning_pool = sum(b["stake"] for b in winners)
            payouts = {}
            settlement = "normal" if winning_pool else "refund"
            if winning_pool:
                floors = {b["id"]: pool * b["stake"] // winning_pool for b in winners}
                remainder = pool - sum(floors.values())
                order = sorted(winners, key=lambda b: (-(pool * b["stake"] % winning_pool), b["id"]))
                payouts = floors
                for b in order[:remainder]:
                    payouts[b["id"]] += 1
            else:
                payouts = {b["id"]: b["stake"] for b in bets}
            for bet in bets:
                amount = payouts.get(bet["id"], 0)
                db.execute("UPDATE bets SET payout=? WHERE id=?", (amount, bet["id"]))
                db.execute("UPDATE users SET balance=balance+? WHERE id=?", (amount, bet["user_id"]))
            db.execute("UPDATE markets SET result=?,settlement=? WHERE id=?", (result, settlement, market_id))

    def snapshot(self, user_id):
        with self.connect() as db:
            user = db.execute("SELECT id,username,role,balance FROM users WHERE id=?", (user_id,)).fetchone()
            if not user:
                raise RuleError("Please log in")
            exams = []
            for exam in db.execute("SELECT * FROM exams ORDER BY starts_at DESC,id DESC").fetchall():
                closed = bool(exam["locked"]) or datetime.fromisoformat(exam["starts_at"]) <= now()
                item = {"id": exam["id"], "title": exam["title"], "starts_at": exam["starts_at"], "closed": closed, "markets": []}
                for m in db.execute("SELECT * FROM markets WHERE exam_id=? ORDER BY id", (exam["id"],)).fetchall():
                    own = db.execute("SELECT side,stake,payout FROM bets WHERE market_id=? AND user_id=? ORDER BY id DESC", (m["id"], user_id)).fetchall()
                    own_bets = [dict(b) for b in own]
                    if m["result"]:
                        for bet in own_bets:
                            bet["net"] = bet["payout"] - bet["stake"]
                    market = {"id": m["id"], "kind": m["kind"], "prompt": m["prompt"], "result": m["result"], "settlement": m["settlement"], "my_bets": own_bets}
                    if m["result"] or user["role"] == "admin":
                        totals = dict(db.execute("SELECT side,SUM(stake) FROM bets WHERE market_id=? GROUP BY side", (m["id"],)).fetchall())
                        market["pool"] = {"YES": totals.get("YES", 0), "NO": totals.get("NO", 0)}
                    item["markets"].append(market)
                exams.append(item)
            # Rank by settled profits only, so active stakes and balances stay private.
            leaderboard = [dict(r) for r in db.execute("""SELECT u.username, COALESCE(SUM(b.payout-b.stake),0) AS profit FROM users u LEFT JOIN bets b ON b.user_id=u.id AND b.market_id IN (SELECT id FROM markets WHERE result IS NOT NULL) WHERE u.role='player' GROUP BY u.id ORDER BY profit DESC,u.username""").fetchall()]
            return {"user": dict(user), "exams": exams, "leaderboard": leaderboard}


store = Store()


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload, cookie=None):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(data)

    def _token(self):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
            return cookies["session"].value if "session" in cookies else None
        except Exception:
            return None

    def _user(self):
        user = store.session_user(self._token())
        if not user:
            raise RuleError("Please log in")
        return user

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            path = "/index.html"
        if path in ("/index.html", "/style.css", "/ui.js"):
            data = (ROOT / path[1:]).read_bytes()
            kind = {".html": "text/html", ".css": "text/css", ".js": "text/javascript"}[Path(path).suffix]
            self.send_response(200)
            self.send_header("Content-Type", kind + "; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        try:
            if path == "/api/state":
                return self._send(200, store.snapshot(self._user()))
            self._send(404, {"error": "Not found"})
        except RuleError as exc:
            self._send(401, {"error": str(exc)})

    def do_POST(self):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 0 or size > 10000:
                raise RuleError("Request too large")
            data = json.loads(self.rfile.read(size) or b"{}")
            path = urlparse(self.path).path
            if path == "/api/login":
                user = store.authenticate(data.get("username", ""), data.get("password", ""))
                token = store.create_session(user)
                return self._send(200, store.snapshot(user), f"session={token}; HttpOnly; SameSite=Strict; Path=/")
            if path == "/api/logout":
                store.logout(self._token())
                return self._send(200, {"ok": True}, "session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/")
            user = self._user()
            if path == "/api/exams":
                store.create_exam(user, data.get("title", ""), data.get("starts_at", ""))
            elif path == "/api/markets":
                store.create_market(user, int(data["exam_id"]), data.get("kind"), data.get("prompt", ""))
            elif path == "/api/bets":
                store.place_bet(user, int(data["market_id"]), data.get("side"), data.get("stake"))
            elif path == "/api/lock":
                store.lock_exam(user, int(data["exam_id"]))
            elif path == "/api/settle":
                store.settle_market(user, int(data["market_id"]), data.get("result"))
            else:
                return self._send(404, {"error": "Not found"})
            self._send(200, store.snapshot(user))
        except RuleError as exc:
            self._send(400, {"error": str(exc)})
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            self._send(400, {"error": "Invalid request"})


if __name__ == "__main__":
    store.initialize()
    port = int(os.environ.get("PORT", "8000"))
    print(f"Exam Prediction Lab: http://localhost:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
