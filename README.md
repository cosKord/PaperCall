# PaperCall · Exam Prediction Market

A points-only exam prediction market. The new FastAPI pilot runs beside the original demo and uses a separate database. The old `exams.db` is never overwritten.

## Local start (Windows PowerShell)

From `D:\projects\ExamsMinigame`:

```powershell
python -m pip install -r requirements.txt
python -m scripts.migrate_demo exams.db pilot.db --apply
python -m scripts.bootstrap_admin --email admin@somaiya.edu
$env:PILOT_MODE = '1'
$env:PILOT_ADMIN_CODE = '2111'
python -m uvicorn app.api:app --host 127.0.0.1 --port 8000
```

Skip migration if `exams.db` does not exist or `pilot.db` already exists. Bootstrap prints a private `otpauth://` URI for an authenticator app. Open <http://localhost:8000>. Local pilot mode shows login codes on the login screen. With `PILOT_ADMIN_CODE=2111`, the admin's second step is **2111** from this computer; without that setting, use the authenticator code. The admin manually assigns each player's verified branch.

The exam creator enters every branch writing the subject and its home branches. The form assigns one start time to all listed branches; use the API for differing times. Betting closes at the earliest branch's exam start. Players cannot see other bets, pools, or odds until settlement. Each bet is final and limited by the available balance and tier cap. An empty winning side or a void topic refunds its stakes. Losing bets show negative net scores.

## Supabase as the database

The app connects to **Supabase Postgres from the Python server**. It does not use Supabase Auth or expose the database to the browser.

1. Create a Supabase project. In its dashboard click **Connect**. Choose **Session pooler** for an IPv4-only host, or **Direct connection** for a persistent backend with IPv6. Copy the exact URL; pooler hostnames and usernames must come from the dashboard.
2. Replace `[YOUR-PASSWORD]` with your database password, percent-encoding reserved characters. The app selects Psycopg and adds `sslmode=require` unless the URL specifies a stronger mode. For full certificate verification, use Supabase's root certificate with `sslmode=verify-full` and `sslrootcert`.
3. Set it in the server environment, for example `$env:DATABASE_URL = 'postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require'`. Every uppercase value is a placeholder. Never paste the real URL into frontend code, the repo, or chat.
4. To transfer existing FCOA data into a **new, empty** Supabase database, run `python -m scripts.migrate_demo exams.db "$env:DATABASE_URL" --apply`. This sends existing users, bets and balances to Supabase; review the transfer before running it. For a blank database, skip migration and start the app; it creates tables automatically.
5. With `DATABASE_URL` still set, run `python -m scripts.bootstrap_admin --email YOUR_ADMIN@somaiya.edu`, configure production settings below, then start Uvicorn. Question-paper files need a persistent `UPLOAD_DIR`; Postgres stores their hashes and paths, not file bytes.

Postgres tables are created with Row Level Security enabled and no browser policies. Keep the database URL and privileged keys on the server. No Supabase API key is needed for the database connection.

## Production configuration

Set `APP_ENV=production`, a long random `OTP_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `DATABASE_URL`, and a persistent `UPLOAD_DIR`. Leave `PILOT_MODE` and `PILOT_ADMIN_CODE` unset; production rejects either setting. Serve the app behind HTTPS and keep Uvicorn bound to a private address. Startup refuses production mode if SMTP or the OTP secret is missing. `.env.example` lists variables; do not commit real values.

For local SQLite, back up with `python -m scripts.backup_db pilot.db backups/pilot-YYYY-MM-DD.db`. Stop the server before restoring and preserve the current DB separately. For Supabase, use its database backup facilities. Keep one server process for this pilot: IP rate limits are currently in process memory.

## Project structure

```text
ExamsMinigame/
├── app/          # FastAPI routes and business rules
├── frontend/     # index.html, app.js and app.css
├── scripts/      # migration, admin setup and backup commands
├── tests/        # automated behavior tests
├── uploads/      # uploaded question papers (created when needed)
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

## Tests

```powershell
python -m pytest -q --basetemp=.pytest_run
node --check frontend/app.js
```

The original `exams.db` remains available as migration input. The current app uses `pilot.db` locally.
