-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "username" VARCHAR(120),
    "branch" VARCHAR(80),
    "role" VARCHAR(20) NOT NULL DEFAULT 'player',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "totp_secret" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_details" (
    "user_id" INTEGER NOT NULL,
    "full_name" VARCHAR(120),
    "academic_year" VARCHAR(30),
    "avatar_path" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_details_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "token_hash" VARCHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "admin_verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "login_codes" (
    "email" VARCHAR(254) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" SERIAL NOT NULL,
    "subject" VARCHAR(120) NOT NULL,
    "exam_type" VARCHAR(20) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "lockout_at" TIMESTAMPTZ(3) NOT NULL,
    "grant_pts" INTEGER NOT NULL,
    "home_branches" JSONB NOT NULL,
    "min_stake" INTEGER NOT NULL DEFAULT 1,
    "away_min_stake" INTEGER NOT NULL DEFAULT 10,
    "low_cap_pct" INTEGER NOT NULL DEFAULT 20,
    "high_cap_pct" INTEGER NOT NULL DEFAULT 40,
    "status" VARCHAR(20) NOT NULL,
    "paper_path" TEXT,
    "paper_hash" VARCHAR(64),
    "settled_at" TIMESTAMPTZ(3),
    "legacy" BOOLEAN NOT NULL DEFAULT false,
    "review_needed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_exams" (
    "id" SERIAL NOT NULL,
    "market_id" INTEGER NOT NULL,
    "branch" VARCHAR(80) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branch_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" SERIAL NOT NULL,
    "market_id" INTEGER NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "tier" VARCHAR(10) NOT NULL,
    "outcome" VARCHAR(10),

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "side" VARCHAR(10) NOT NULL,
    "stake" INTEGER NOT NULL,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "market_id" INTEGER,
    "bet_id" INTEGER,
    "amount" INTEGER NOT NULL,
    "reason" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_claims" (
    "user_id" INTEGER NOT NULL,
    "market_id" INTEGER NOT NULL,

    CONSTRAINT "grant_claims_pkey" PRIMARY KEY ("user_id","market_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER,
    "action" VARCHAR(80) NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_previews" (
    "market_id" INTEGER NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "outcomes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_previews_pkey" PRIMARY KEY ("market_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "branch_exams_market_id_branch_key" ON "branch_exams"("market_id", "branch");

-- CreateIndex
CREATE UNIQUE INDEX "bets_user_id_topic_id_key" ON "bets"("user_id", "topic_id");

-- AddForeignKey
ALTER TABLE "profile_details" ADD CONSTRAINT "profile_details_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_exams" ADD CONSTRAINT "branch_exams_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_claims" ADD CONSTRAINT "grant_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_claims" ADD CONSTRAINT "grant_claims_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_previews" ADD CONSTRAINT "settlement_previews_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
