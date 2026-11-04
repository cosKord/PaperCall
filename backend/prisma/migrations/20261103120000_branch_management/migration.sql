CREATE TABLE "branches" (
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("name")
);

INSERT INTO "branches" ("name")
VALUES ('IT'), ('CSE'), ('AIDS'), ('CSBS'), ('MECH'), ('CCE')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "branches" ("name")
SELECT DISTINCT source."name"
FROM (
    SELECT UPPER(BTRIM("branch")) AS "name"
    FROM "users"
    WHERE "branch" IS NOT NULL AND BTRIM("branch") <> ''

    UNION

    SELECT UPPER(BTRIM("branch")) AS "name"
    FROM "branch_exams"
    WHERE BTRIM("branch") <> ''

    UNION

    SELECT UPPER(BTRIM(value #>> '{}')) AS "name"
    FROM "markets", LATERAL jsonb_array_elements("home_branches") AS value
    WHERE BTRIM(value #>> '{}') <> ''
) AS source
ON CONFLICT ("name") DO NOTHING;
