# Pilot release checklist

1. Keep a backup of the original `exams.db`. Migrate to a new target and reconcile every user's ledger sum with the old balance before switching traffic.
2. Set `APP_ENV=production`, Supabase `DATABASE_URL`, SMTP variables, `OTP_SECRET`, and a persistent `UPLOAD_DIR`. Leave `PILOT_MODE` off. Bootstrap one admin and enroll TOTP.
3. Serve HTTPS through a reverse proxy. Keep the Python port private. Store secrets only in the host's secret manager or process environment.
4. Verify a test signup, branch assignment, grant, bet, close, paper upload, preview, settlement, signed score, and restore of a database backup.
5. Keep one worker until the IP rate limiter moves to shared storage. Monitor the audit log and reconcile ledger totals daily.
6. Invite a small class group only after college email delivery, branch mapping, database backups, and paper storage are ready.

The `DATABASE_URL` is a privileged server credential. Never expose it through the frontend or a public API. The app enables RLS without policies on its Postgres tables; browser-side Supabase access is unavailable.
