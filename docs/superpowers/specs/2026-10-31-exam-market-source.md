<!-- doc-rev: 9c4e1b7a | 2026-10-31 -->
# Exam Prediction Market

A points-based prediction market for exams. Before an exam, classmates bet on which syllabus topics (and narrower, higher-stakes claims) will appear in the question paper. Bets close before the exam starts. After the exam, the uploaded question paper settles every bet and points are paid out automatically.

> Status: **planning**. This document is the single source of truth for scope, rules, data model, security and build order. Items marked **(open)** still need a decision.

---

## 1. Goals and non-goals

**Goals**

- A fair, low-stakes game that crowd-sources "what will the paper contain?"
- Rules enforced by the system (server clock, database constraints), never by trust.
- Simple settlement: the uploaded question paper is the only source of truth.
- A leaderboard that makes it fun to come back every exam.

**Non-goals (v1)**

- No real money, ever. Points have no cash value.
- No transfers or gifting between users. Points can only be bet, won or lost.
- No user-created markets or topics. The admin defines every market.
- No mobile app. A responsive web app is enough.

---

## 2. How it works (lifecycle)

1. **Setup (admin).** Create a market for an exam: subject, exam type (midsem / endsem), exam start time, `lockout_at`, grant amount. Add the syllabus topics and claims users can bet on.
2. **Open.** Users log in, receive that exam's point grant, and place bets until the cutoff.
3. **Close.** At `lockout_at` (30 minutes before the exam, e.g. 10:00 for a 10:30 start) the market locks automatically. Pool totals and live odds become visible.
4. **Exam happens.** Nothing in the app changes.
5. **Settle (admin).** The admin uploads the question paper, marks each topic **hit** or **miss**, and runs settlement once. Payouts are computed and credited automatically.
6. **Publish.** The question paper and payouts are shown to everyone. The leaderboard updates.

Market status: `draft` → `open` → `closed` → `settled`.

---

## 3. Rules

### 3.1 Betting

- Each topic is a yes/no market with two sides: **Hit** (it appears) and **Miss** (it doesn't).
- A user may bet on both sides of different topics, but only one side per topic. **(open: allow hedging both sides of the same topic? Default: no.)**
- Stake is a positive integer. The minimum is set per market and is higher for outsiders (see 3.5). Maximum per bet is a percentage of current balance (default **20%**, configurable per market).
- Bets are **final**. No editing, cancelling or withdrawing once placed.
- Strictly before `lockout_at` is valid. `lockout_at` exactly or later is rejected.

### 3.2 What counts as "hit"

A topic is a **hit** if at least one question in the paper requires that topic to be solved, even partly. A question that spans two topics counts as a hit for both. This rule is published before the market opens.

### 3.3 Stakes tiers

| Tier | What users bet on | Intent |
|------|-------------------|--------|
| Low stakes | A syllabus topic ("a Laplace shifting problem appears") | Broad, easier call |
| High stakes | A narrower claim defined in advance by the admin (a subtopic or question type, e.g. "a Fourier half-range series appears") | Long shot, pays more |

Because bets close before anyone sees the paper, users cannot bet on an exact question number. High-stakes claims must be written so they can be checked unambiguously against the paper. **(open: does the tier add a payout multiplier or only change the stake cap? Default: parimutuel odds do the work, tier only sets the cap.)**

### 3.4 Payouts (parimutuel)

All points staked on a topic form one pool. Winners split the whole pool in proportion to their stake on the winning side. The crowd sets the odds, so nothing needs to be priced by hand.

For a winning bet:

$$
\text{payout} = \left\lfloor \text{stake} \times \frac{\text{total pool on the topic}}{\text{total staked on the winning side}} \right\rfloor
$$

Edge cases:

- **Nobody backed the winning side:** every bet on that topic is refunded in full.
- **Nobody bet on the topic:** nothing happens.
- **Rounding:** payouts are floored to integers; leftover fractions are discarded.
- **Voided topic** (ambiguous or dropped from the syllabus): admin marks it `void` and all stakes are refunded.

### 3.5 Rooms and branches

Subjects differ by branch, but some overlap, so each market is a **room** tied to a subject and a list of **home branches**.

- Anyone can bet in any room, including rooms outside their own branch.
- **Insiders** are users whose branch is in the market's `home_branches`. Everyone else is an **outsider**.
- **Payout rules are identical for everyone.** There is no payout bonus and no haircut for outsiders. A bigger payout for outsiders was considered and dropped: informed outsiders (a friend inside, or someone who took the subject before) would collect it without carrying the extra risk, and it would come out of insiders' winnings.
- **Outsiders have a higher minimum stake** (`away_min_stake`) than insiders (`min_stake`). Outsider bets are therefore bigger and riskier, and casual taps on random topics are filtered out. Suggested starting values: 1 for insiders, 10 for outsiders **(open: final numbers)**. The outsider minimum must never exceed the stake cap, or a new user with a small balance would be locked out.
- **Branch is verified and locked.** It comes from the college email or an uploaded roll-number allowlist and only an admin can change it. Otherwise people would claim whichever branch suits them.
- **Earliest-exam rule.** If a subject is written by several branches at different times, the market closes before the earliest start across all of them, and any branch that has already written the exam cannot bet in that room.
- **Leaderboards:** one global leaderboard (points carry over), plus a per-room view.

---

## 4. Points economy

- Points **carry over** between exams.
- Each exam also **grants** a nominal amount of new points: a bit less for a midsem, a bit more for an endsem. The amount lives on the market row, so it is set once per exam. Suggested starting values: **100** (midsem), **150** (endsem). **(open: final numbers.)**
- Points are non-transferable. Balances change in exactly two ways: placing a bet (deduct) and settlement (payout or refund).
- The balance is the **sum of a ledger**, not a mutable counter, so every number can be audited.

Known economy trade-offs to keep in mind:

- Carry-over favours early joiners. Mitigations: stake cap as a percentage of balance, a per-exam leaderboard next to the season total, and optionally a catch-up grant for late joiners.
- Losing a bet is effectively a transfer (an alt account can bet the losing side to feed a main account). It can't be fully prevented. Defences: one verified account per person, stake caps, and an audit log. The game is low stakes, and alt accounts are banned in the rules.
- Nobody goes permanently bust, because each exam grants fresh points.

---

## 5. Architecture

**Proposed stack (open: confirm)**

- Frontend and API: **Next.js** (or **FastAPI** if Python is preferred)
- Database and auth: **Postgres on Supabase** (login, backups and managed clocks included)
- Hosting: Vercel (or any managed host with NTP-synced servers)
- Validation: Zod (Next.js) or Pydantic (FastAPI)

Lighter option for a single class: FastAPI with SQLite.

---

## 6. Data model

```sql
CREATE TABLE users (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,          -- college domain only
  branch      text NOT NULL,                 -- verified; admin-only to change
  role        text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE markets (
  id            uuid PRIMARY KEY,
  subject       text NOT NULL,
  exam_type     text NOT NULL CHECK (exam_type IN ('midsem','endsem','other')),
  exam_starts   timestamptz NOT NULL,
  lockout_at    timestamptz NOT NULL,        -- stored in UTC
  grant_pts     integer NOT NULL,
  stake_cap_pct integer NOT NULL DEFAULT 20,
  home_branches text[] NOT NULL,             -- insiders for this room
  min_stake     integer NOT NULL DEFAULT 1,  -- insiders
  away_min_stake integer NOT NULL DEFAULT 10, -- outsiders
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','open','closed','settled')),
  qp_url        text,                        -- set at settlement
  CHECK (lockout_at <= exam_starts),
  CHECK (away_min_stake >= min_stake)
);

CREATE TABLE topics (
  id         uuid PRIMARY KEY,
  market_id  uuid NOT NULL REFERENCES markets(id),
  title      text NOT NULL,
  tier       text NOT NULL CHECK (tier IN ('low','high')),
  outcome    text CHECK (outcome IN ('hit','miss','void'))   -- NULL until settled
);

CREATE TABLE bets (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  topic_id    uuid NOT NULL REFERENCES topics(id),
  side        text NOT NULL CHECK (side IN ('hit','miss')),
  stake       integer NOT NULL CHECK (stake > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id)                 -- one bet per user per topic
);
-- bets are immutable: no UPDATE or DELETE grants for the app role

CREATE TABLE points_ledger (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  market_id   uuid NOT NULL REFERENCES markets(id),
  amount      integer NOT NULL,              -- negative for bets
  reason      text NOT NULL CHECK (reason IN ('grant','bet','payout','refund')),
  bet_id      bigint REFERENCES bets(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- one grant per user per exam, enforced by the database
CREATE UNIQUE INDEX uq_ledger_grant_9c4e
  ON points_ledger (user_id, market_id) WHERE reason = 'grant';

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid NOT NULL,
  action      text NOT NULL,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Balance = `SELECT COALESCE(SUM(amount), 0) FROM points_ledger WHERE user_id = $1`, with a constraint or transactional check that it never goes below zero.

---

## 7. Time enforcement

Same principles Codeforces relies on:

1. **The server's clock is the only clock.** Device time is never used.
2. **Store everything in UTC.** Show IST only in the UI. Example: 10:00 IST is 04:30 UTC.
3. **The database performs the check inside the insert transaction**, so a bet at 09:59:59.9 cannot slip past a separate app-level check:

```sql
INSERT INTO bets (user_id, topic_id, side, stake, created_at)
SELECT $1, $2, $3, $4, now()
FROM topics t
JOIN markets m ON m.id = t.market_id
WHERE t.id = $2
  AND m.status = 'open'
  AND now() < m.lockout_at;
```

   Zero rows inserted means the bet was too late and is rejected.
4. **The countdown is cosmetic.** The client fetches `/api/time` on load, computes `offset = serverTime - Date.now()`, and renders from `Date.now() + offset`, re-syncing roughly every minute. The bet button disables at zero, but the server is the real gate.
5. **Judge by receipt time, not click time.** Users are told to bet early and that a bet only counts once the confirmation screen appears.
6. **Auto-close.** Either a scheduled job flips status to `closed` at `lockout_at`, or status is derived from `now() >= lockout_at` on every read. Don't depend on a manual switch.
7. **Close before the earliest exam.** For subjects written by several branches at different times, `lockout_at` is set before the earliest start among them (see 3.5).

---

## 8. Security

Threat model: mostly cheating and integrity, not outside attackers.

**Accounts**

- Signup restricted to the college email domain, with email verification (OTP or magic link). One account per email.
- Same rules for everyone. Alt accounts are banned.
- Branch comes from verified data and is locked. Users cannot edit it themselves, since it decides insider or outsider status and the minimum stake.

**Authorization**

- `user_id` always comes from the authenticated session, never from the request body.
- Ownership is checked in the query (`WHERE id = $1 AND user_id = $session_user`) to prevent IDOR.
- Admin actions are checked server-side by role. Hiding a button is not authorization.
- 2FA on the admin account.

**Integrity**

- Atomic balance check on every bet. Never read-then-write:

```sql
-- inside the same transaction as the bet insert
INSERT INTO points_ledger (user_id, market_id, amount, reason, bet_id)
SELECT $uid, $market, -$stake, 'bet', $bet_id
WHERE (SELECT COALESCE(SUM(amount),0) FROM points_ledger WHERE user_id = $uid) >= $stake;
```

  Lock the user's row (`SELECT ... FOR UPDATE`) first so parallel requests cannot double-spend.
- Validate stake as a positive integer within min and max, in code and in the database.
- Grants are idempotent through the unique index in section 6.
- Settlement is idempotent: once a market is `settled`, running it again does nothing.
- Every settlement and admin action goes to the append-only `audit_log`.

**Information hiding**

- Pool totals and odds must not appear in any API response while the market is open. Hiding them in the UI is not enough.
- If using Supabase, enable **Row Level Security** on every table with explicit policies. The service-role key must never reach the browser.

**General hygiene**

- HTTPS only; secure, `httpOnly`, `sameSite` cookies.
- Parameterized queries only; schema validation on all input.
- Rate limiting on login and bet endpoints, per user and per IP.
- Secrets in environment variables, never in the repo.
- Database backups on, so a bad settlement can be rolled back.

---

## 9. API sketch

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/time` | public | Server time for the countdown |
| POST | `/api/auth/*` | public | Signup, OTP verification, login |
| GET | `/api/markets` | user | List markets and their status |
| GET | `/api/markets/:id` | user | Topics, the user's bets, and pools only if closed |
| POST | `/api/markets/:id/claim-grant` | user | Idempotent point grant for the exam |
| POST | `/api/bets` | user | Place a bet (cutoff, branch-based minimum stake, stake cap, balance, one-per-topic checks) |
| GET | `/api/me` | user | Balance and bet history |
| GET | `/api/leaderboard` | user | Season and per-exam rankings |
| POST | `/api/admin/markets` | admin | Create or edit a draft market and topics |
| POST | `/api/admin/markets/:id/settle` | admin | Upload the QP, set outcomes, run payouts once |

---

## 10. Pages

- **Login / signup:** college email and OTP.
- **Dashboard:** open markets, balance, countdown to close.
- **Market page:** topic list with tier, bet form, the user's existing bets. After close: pools, odds, and after settlement, outcomes and payouts.
- **Leaderboard:** season total plus per-exam tabs.
- **My bets:** history with results.
- **Admin:** create market, add topics, settlement screen (upload QP, mark outcomes, preview payouts, confirm).

---

## 11. Settlement procedure

1. Wait for the exam to finish and the question paper to be available.
2. Upload the QP and attach `qp_url` to the market.
3. Mark every topic `hit`, `miss` or `void`.
4. Review the **payout preview** (who gets what).
5. Confirm. In one transaction: write payout and refund ledger rows, set status to `settled`, write the audit log entry.
6. Publish the QP and results to everyone.

Rules: settle within a published window (for example, within 24 hours of the QP being available). A second person verifies the outcomes, or the QP is posted publicly with the payouts. The admin sits the exam and runs the market, so either abstain from betting or disclose it.

---

## 12. Build order

1. **Foundation:** project setup, database schema, auth with college-email restriction.
2. **Points:** ledger, grant endpoint, balance calculation.
3. **Markets and topics:** admin creation, status lifecycle, auto-close.
4. **Betting:** the atomic bet endpoint with all checks, the server-synced countdown.
5. **Settlement:** admin screen, payout preview, idempotent settle.
6. **Visibility:** hidden-until-close pools, odds display, results page.
7. **Leaderboard:** season and per-exam.
8. **Hardening:** RLS policies, rate limits, audit log review, backups, load and race testing.
9. **Pilot:** run one real low-stakes market with a small group before the full class.

---

## 13. Testing checklist

- Bet at 09:59:59 is accepted; bet at 10:00:00 and later is rejected.
- Changing the device clock has no effect on acceptance.
- 20 parallel bets with a balance for only 1 result in exactly 1 success.
- Negative, zero and oversized stakes are rejected.
- Second bet on the same topic is rejected.
- An outsider bet below `away_min_stake` is rejected; an insider bet at `min_stake` is accepted.
- A branch that has already written the exam cannot bet in that market.
- A user cannot change their own branch.
- A user cannot read or modify another user's bets.
- Pool totals are absent from API responses while the market is open.
- Claiming the grant twice credits it once.
- Running settlement twice pays once.
- Empty winning side refunds all stakes; a voided topic refunds all stakes.
- Ledger sum matches the expected balance after a full simulated market.

---

## 14. Open decisions

- Final tech stack (Next.js vs FastAPI, Supabase vs SQLite).
- Exact grant amounts for midsem and endsem.
- How the high-stakes tier is paid (cap only vs multiplier) and how those claims are worded.
- Whether a user may bet both sides of the same topic.
- Catch-up grant for late joiners, and whether to show a per-exam leaderboard.
- Settlement deadline and who verifies the result.
- Exact insider and outsider minimum stakes, and how branches are verified (email pattern vs roll-number allowlist).
