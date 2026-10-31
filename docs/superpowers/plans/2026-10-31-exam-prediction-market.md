# Exam Prediction Market Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the working local demo into a secure, auditable, points-only class pilot while preserving its current exams, bets, and balances.

**Architecture:** Keep the existing browser UI and SQLite data, but move the HTTP layer to FastAPI and split the business rules into focused modules. One SQLite writer transaction handles each grant, bet, or settlement. The ledger becomes the source of balance truth; API responses expose only data appropriate to the caller and market phase.

**Tech Stack:** Python 3.10+, FastAPI/Pydantic, SQLite, vanilla HTML/CSS/JavaScript, pytest and FastAPI TestClient. Run as one server with a persistent local disk for the pilot; put HTTPS and scheduled backups in front of it before inviting classmates.

**Spec:** `docs/superpowers/specs/2026-10-31-exam-market-source.md` (archived copy of the user-supplied `C:\Users\Aditya\Desktop\README (2).md`). This is source material for the plan, not an instruction to start implementation.

## Global Constraints and Proposed Decisions

- Preserve `D:\projects\ExamsMinigame\exams.db` and existing FCOA history. Back it up, migrate a copy, verify balances and counts, then replace it only after a reviewed cutover. Never silently reset it.
- No real money, transfers, or player-created markets. Admin creates all topics and claims.
- **Prior user preference wins over the source README:** no other players' bets, pool distribution, or odds before the exam is over. For this pilot, reveal pools and odds only after settlement, not at the 30-minute lockout. The admin may see pools for operations.
- Proposed pilot defaults requiring review: FastAPI + SQLite; `lockout_at` defaults to 30 minutes before the earliest branch exam; 100 midsem/150 endsem grant; one bet per user per topic; low-tier stake cap 20% of balance and high-tier cap 40% (both configurable from 1–100%); insider/outsider minimum 1/10; no payout multiplier; no catch-up grant; season and per-exam leaderboards.
- Proposed verification: college email plus a college-provided roll-number/branch allowlist. Do not infer branch from an email unless its format is documented. Provide a test mail transport; production email delivery needs credentials before launch. Admin login also requires TOTP.
- Proposed settlement policy: require the uploaded question paper and outcomes for every topic; publish them with payouts. Show a 24-hour settlement target, but allow a late audited settlement so missed deadlines cannot strand points. An admin who sat the exam should disclose participation.
- The uploaded paper is evidence for admin-marked hit/miss/void outcomes. This pilot does not attempt OCR-based automatic grading; the source README's settlement procedure requires an admin to mark every topic.
- Use the README's floor-and-discard rounding for the next version. This differs from the prototype's largest-remainder allocation; make the change explicit in the UI and migration notes. Never recalculate historical payouts.
- Use UTC in storage and server decisions; render IST in the UI. A countdown is informational only.
- The folder is currently **not a Git repository**. Initialize Git before code changes; ignore the database, uploads, secrets, and backup files. Make small commits after each passing task.

## File Map

- `market_app/db.py`, `migrations/001_market.sql`: connection/transaction helpers and schema constraints.
- `tools/migrate_demo.py`: one-time migration from the prototype schema, with dry run and balance reconciliation.
- `market_app/auth.py`: email verification, sessions, branch identity, admin TOTP.
- `market_app/markets.py`: admin market/topic setup, timing, branch schedules, one-time grants.
- `market_app/betting.py`: atomic placement and all eligibility checks.
- `market_app/settlement.py`: question-paper attachment, preview, final transaction, audit.
- `market_app/views.py`: caller-safe market, bet history, balance and leaderboard queries.
- `market_app/api.py`, `market_app/main.py`: validated routes, error mapping, static file serving.
- `index.html`, `ui.js`, `style.css`: existing responsive interface, upgraded in place.
- `tests/`: focused database, API, concurrency, and browser-flow tests.
- `requirements.txt`, `README.md`, `deployment/README.md`: reproducible install, migration, backup, and pilot operations.

## API Contract

- Public: `GET /api/time`, `POST /api/auth/request-code`, `POST /api/auth/verify-code`, `POST /api/auth/admin-totp`.
- Player: `GET /api/markets`, `GET /api/markets/{id}`, `POST /api/markets/{id}/claim-grant`, `POST /api/bets`, `GET /api/me`, `GET /api/leaderboard?scope=season|market&market_id=...`.
- Admin: `POST /api/admin/markets`, `POST /api/admin/markets/{id}/topics`, `POST /api/admin/markets/{id}/publish`, `POST /api/admin/markets/{id}/paper`, `POST /api/admin/markets/{id}/settlement-preview`, `POST /api/admin/markets/{id}/settle`.
- All player identity comes from the session cookie; no write endpoint accepts a client-supplied `user_id` or branch. Mutating routes require CSRF protection. Error responses never include another player's wager.

## Review Focus

1. A bet arriving exactly at `lockout_at` must fail, even when the browser button was pressed earlier. Task 4 test pins the transaction boundary.
2. Concurrent bets or grants must not overspend or double-credit. Tasks 3 and 4 test multiple connections.
3. A forged branch or `user_id` must never change a stake minimum or reveal another user's bets. Tasks 2, 4, and 6 test this at the API boundary.
4. Retrying a settlement after a lost response must not pay twice or replace the published paper. Task 5 tests the replay.
5. Migration must reconcile every legacy user's ledger sum with the old balance, and preserve settled payouts. Task 1 tests a copy of the real database.

---

### Task 1: Baseline, schema, and lossless migration

**Files:** Create `requirements.txt`, `market_app/__init__.py`, `market_app/db.py`, `migrations/001_market.sql`, `tools/migrate_demo.py`, `tests/test_migration.py`; modify `.gitignore`, `README.md`.

**Interfaces:** Produce `connect(path: Path) -> ContextManager[sqlite3.Connection]`, `migrate_demo(source: Path, target: Path, dry_run: bool) -> MigrationReport`, and `balance(db, user_id: int) -> int`. Later tasks use these interfaces.

- [ ] Write a migration test using a copied legacy database with a settled win, loss, refund, and a pending bet. Assert migrated user/market/bet counts, immutable old payouts, and `SUM(points_ledger.amount) == old users.balance` for every user.
- [ ] Run `rtk python -m pytest tests/test_migration.py -q`; confirm it fails because migration is absent.
- [ ] Implement the schema and migration. Add a migration-only `opening` ledger reason with nullable market ID; import each legacy user's original 1,000-point opening balance, then one debit per bet and one payout/refund credit for each settled bet. Import legacy exams as read-only history (`exam_type='other'`); mark unsettled ones closed and needing admin review, without inventing a question paper, branch, or old cutoff. Assert reconciliation before writing the target. Mark legacy username accounts inactive until college identity is linked. Preserve source IDs or a mapping table. Keep the original DB untouched.
- [ ] Re-run the focused test, then `rtk python -m pytest -q`; both must pass. Inspect the migration report against a copy of the current FCOA database.
- [ ] Initialize Git if absent, then commit schema, migration, tests, and docs; exclude all `.db` files and backups.

### Task 2: Verified identities and server-side authorization

**Files:** Create `market_app/auth.py`, `tests/test_auth.py`; modify `market_app/api.py`, `market_app/main.py`, `migrations/001_market.sql`, `ui.js`.

**Interfaces:** Produce `request_login(email: str, mailer: Mailer) -> None`, `verify_code(email: str, code: str) -> Session`, `current_user(session_token: str) -> User`, `require_admin(user: User) -> None`, `verify_admin_totp(user: User, code: str) -> None`. Session identity supplies the user ID to all later services.

- [ ] Write failing tests: non-college email denied; expired/replayed OTP denied; unlisted roll number denied; branch is immutable to the player; another user's ID in JSON is ignored; player cannot call admin routes; admin without TOTP cannot settle; login rate limit returns 429.
- [ ] Run `rtk python -m pytest tests/test_auth.py -q`; confirm the intended failures.
- [ ] Implement hashed, expiring OTPs with a mailer interface; allowlist-backed branch assignment; expiring `HttpOnly`, `Secure`, `SameSite` sessions; admin TOTP; rate limiting. Secrets and email transport settings come from environment variables. Remove demo credentials from the pilot UI and disable legacy username login after migration.
- [ ] Run focused and full suites; verify unauthorized responses do not leak account existence or private records. Commit.

### Task 3: Exam rooms, topics, time, and grants

**Files:** Create `market_app/markets.py`, `tests/test_markets.py`; modify `market_app/api.py`, `migrations/001_market.sql`, `ui.js`.

**Interfaces:** Produce `create_market(admin: User, data: MarketCreate) -> int`, `add_topic(admin: User, market_id: int, data: TopicCreate) -> int`, `market_phase(db, market_id: int, at: datetime) -> Phase`, `claim_grant(user: User, market_id: int) -> int`, and `server_time() -> datetime`.

- [ ] Write failing tests: draft creation/edit is admin-only; publish freezes rules; `lockout_at` precedes the earliest branch start by the configured interval; a later branch cannot extend that cutoff; `market_phase` closes at the exact cutoff; simultaneous grant claims credit only once; invalid minimum/cap combinations are rejected.
- [ ] Run the focused tests and confirm failures.
- [ ] Implement subject, exam type, branch schedules, home branches, low/high topics, grant amount, draft/open/closed/settled phases and `/api/time`. Use the database's transaction-time UTC value for cutoff decisions. Use a unique ledger constraint for each user/market grant.
- [ ] Run focused and full suites; commit.

### Task 4: Atomic, final bets

**Files:** Create `market_app/betting.py`, `tests/test_betting.py`; modify `market_app/api.py`, `migrations/001_market.sql`, `ui.js`.

**Interfaces:** Produce `place_bet(user: User, topic_id: int, side: Literal['hit','miss'], stake: int) -> BetReceipt` and `get_my_bets(user: User, market_id: int) -> list[BetView]`.

- [ ] Write failing tests for 09:59:59 versus 10:00:00 cutoff, device-clock tampering, zero/negative/fractional/oversized stakes, insider/outsider minimums, a branch whose exam already occurred, second bet on a topic, opposite-side hedging, and a request that supplies another `user_id`.
- [ ] Add a 20-request concurrency test against 20 distinct topics, each staking 10 points from a 10-point balance in a market configured for a 100% cap; assert one bet row, one debit row, nonnegative ledger balance, and 19 rejected attempts. Run focused tests and confirm the intended failures.
- [ ] Implement placement in one `BEGIN IMMEDIATE` transaction with a conditional cutoff query, one-side-per-topic unique constraint, balance and cap checks, and a matching negative ledger row. Do not rely on the UI clock. Return the confirmed receipt time.
- [ ] Run focused and full suites; commit.

### Task 5: Question paper, preview, and one-time settlement

**Files:** Create `market_app/settlement.py`, `tests/test_settlement.py`; modify `market_app/api.py`, `migrations/001_market.sql`, `ui.js`, `.gitignore`.

**Interfaces:** Produce `attach_paper(admin: User, market_id: int, file: UploadFile) -> PaperRef`, `preview_settlement(admin: User, market_id: int, outcomes: dict[int, Outcome]) -> Preview`, and `confirm_settlement(admin: User, market_id: int, preview_digest: str) -> SettlementResult`.

- [ ] Write failing tests: every topic needs hit/miss/void; settlement before the exam ends fails; missing or invalid paper fails; a no-bet topic pays zero; an empty winning side and void refund all; floor rounding discards remainder; preview totals match committed ledger rows; a replay pays once; a changed paper or outcome invalidates the preview.
- [ ] Run focused tests and confirm failures.
- [ ] Implement bounded PDF/image upload to a private local store with content hash; record an exam end time (or explicit admin completion evidence) before settlement. Preview is read-only. Confirmation uses one transaction to lock the market, validate preview digest, insert payout/refund ledger rows, mark outcomes and settled status, then append the audit entry. Publish the paper only after commit.
- [ ] Run focused and full suites; commit.

### Task 6: Private read models and the responsive pilot UI

**Files:** Create `market_app/views.py`, `tests/test_views.py`, `tests/test_ui.py`; modify `market_app/api.py`, `index.html`, `ui.js`, `style.css`.

**Interfaces:** Produce `market_view(user: User, market_id: int) -> MarketView`, `my_history(user: User) -> list[BetView]`, `leaderboard(scope: Literal['season','market'], market_id: int | None) -> list[RankRow]`.

- [ ] Write failing API tests: open/closed responses omit all other bets, pool totals, odds and inferred live balances; settled responses reveal pools, outcomes, published paper and signed bet net; season and per-market leaderboards use settled profit only. Test an empty leaderboard and escaped topic text.
- [ ] Run focused tests and confirm failures.
- [ ] Implement the read models and pages: verified login, dashboard, market detail, own bets, leaderboard and admin setup/settlement. Sync the countdown from `/api/time` roughly once a minute; keep the server authoritative. Show IST, loading/empty/error states, keyboard focus and mobile layout.
- [ ] Run focused/full suites and one browser pass at desktop and mobile widths; fix any overflow or inaccessible controls. Commit.

### Task 7: Pilot operations and release gate

**Files:** Create `deployment/README.md`, `tests/test_security.py`, `tests/test_recovery.py`; modify `README.md`, `market_app/main.py`, `market_app/api.py`.

**Interfaces:** Produce documented `backup_db(source: Path, destination: Path) -> Path`, restore procedure, and pilot configuration validation at startup.

- [ ] Write failing checks for oversized uploads, login/bet rate limits, missing production secrets, CSRF on cookie-authenticated writes, and a backup/restore round trip that preserves ledger totals and published results.
- [ ] Run focused checks; implement rate limits, CSRF protection, upload bounds, structured audit logging, backup job, and HTTPS-only production configuration. Document a single persistent-volume deployment and recovery drill.
- [ ] Run the full suite, 20-way bet race test, migration dry run, browser smoke test, and backup restore check. Review the audit log and reconcile `SUM(ledger)` for every user.
- [ ] Pilot one small, points-only exam after college email delivery, branch allowlist, HTTPS, storage, backups, and admin TOTP are configured. Keep the demo database as a separate backup. Commit the release docs; do not publish or invite users before a separate go-live decision.

## Self-Review Notes

- Coverage: lifecycle, branches, grants, betting, privacy, settlement, leaderboards, security, and pilot all map to tasks above.
- Data protection: the live prototype database is a migration input, not a disposable fixture. Test against a copy and reconcile before any cutover.
- Decisions to confirm before implementation: stack/deployment target, college domain and branch allowlist source, grant/minimum/cap numbers, rounding, and whether post-lockout pools remain hidden until settlement. The plan uses the proposed defaults above until changed.
