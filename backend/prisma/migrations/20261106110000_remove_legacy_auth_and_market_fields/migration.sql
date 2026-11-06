DROP TABLE "login_codes";

ALTER TABLE "markets"
  DROP COLUMN "low_cap_pct",
  DROP COLUMN "high_cap_pct",
  DROP COLUMN "review_needed";
