# PaperCall

PaperCall is a campus exam prediction game. Students call **Hit** or **Miss** on exam topics using virtual points, follow the shared pool, and compare settled results on the leaderboard. Points have no irl value.

Administrators manage Users, branches, examinations, schedules, topics, market locks, and settlement.

## Under the hood

- Browse examinations and subjects for your branch.
- Call Hit or Miss on a topic using points from your balance.
- See the live distribution of points and an estimated return that includes your proposed stake while calls are open.
- Follow active and settled calls by subject and examination.
- Claim the one-time starting points available to a new player.
- View the leaderboard, edit your profile, and send a problem report.
- Admins upload the question paper, review settlement outcomes against it, and confirm results before they are finalized.
- Admins publish and manage examinations, topics, schedules, and settlement.

## Stack

| Area | Stack |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Fastify 5, Node.js, JavaScript, Zod |
| Database | Supabase-hosted PostgreSQL, Prisma ORM |
| Authentication | Supabase Auth: email/password and Google OAuth |

The browser signs users in through Supabase Auth. The frontend exchanges that identity with the Fastify API, which verifies the Supabase session, creates its own secure session cookie, and uses Prisma to access PostgreSQL. Database credentials and OAuth secrets stay on the server; the browser only needs the Supabase project URL and publishable key.

## Hosted architecture

PaperCall runs as three hosted services:

1. **Frontend:** Vercel hosts the Next.js app and serves the website to players.
2. **API:** a Node.js host runs the Fastify server as a persistent service.
3. **Database and auth:** Supabase provides PostgreSQL and Supabase Auth.

Players visit the Vercel domain. Next.js forwards `/api/*` requests to the hosted Fastify API, so the API origin does not need to appear in page links.

## Deployment

### 1. Create and configure Supabase

Created a SUPABASE Database, migrated the schema, made tables, RLS for every table, etc.

### 2. Deploy the Fastify API

Fastify API was deployed as a separate service from the frontend, using the same repository with the backend directory as its root. Configured it to use Supabase for PostgreSQL and authentication, then applied the prisma migrations before the API started serving requests.

### 3. Deploy the frontend to Vercel

Had to deploy Front-End and Back-End separately, though having the same repo but different root.

### 4. Apply database migrations

Before the API starts serving traffic, ran the release command from the `backend` with the API host's production environment. It applies the checked-in Prisma migrations to Supabase. The build command generates prisma Client; `db:deploy` applies existing migrations without creating new ones.

### Deployment checklist, what I had to do. (and learn for the first time)

- The frontend loads from the Vercel domain.
- The API health endpoint responds at `/` on the API origin.
- `FASTIFY_URL` points to the deployed API origin.
- Email/password and Google sign-in return to the deployed `/login` URL.
- Supabase redirect allowlist and Google OAuth origin use the deployed domain.
- Database migrations have been applied.
- Pilot mode and `PILOT_ADMIN_CODE` are disabled.
- Uploaded file storage persists across API restarts, if uploads are enabled.

## Repository file structure

```text
backend/
  prisma/       Database schema and migrations
  scripts/      Admin account setup
  src/          Fastify routes, auth, markets, and settlement
frontend/
  app/          Next.js routes and pages
  components/   Shared UI components
  lib/          API client, Supabase client, and helpers
```
### See you before the exam starts!
