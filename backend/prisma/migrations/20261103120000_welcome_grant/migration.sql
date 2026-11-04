BEGIN;

ALTER TABLE "users"
ADD COLUMN "welcome_grant_claimed_at" TIMESTAMPTZ(3);

WITH player_balances AS (
  SELECT
    users."id" AS "user_id",
    COALESCE(SUM(ledger."amount"), 0) AS "current_balance"
  FROM "users"
  LEFT JOIN "ledger" ON "ledger"."user_id" = users."id"
  WHERE users."role" = 'player'
  GROUP BY users."id"
)
INSERT INTO "ledger" ("user_id", "amount", "reason", "created_at")
SELECT "user_id", 1000 - "current_balance", 'welcome_reset', CURRENT_TIMESTAMP
FROM player_balances
WHERE "current_balance" <> 1000;

UPDATE "users"
SET "welcome_grant_claimed_at" = CURRENT_TIMESTAMP
WHERE "role" = 'player';

COMMIT;
