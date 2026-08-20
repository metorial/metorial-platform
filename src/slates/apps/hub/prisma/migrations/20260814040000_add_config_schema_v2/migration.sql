ALTER TABLE "SlateConfigSchema"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "descriptorHash" TEXT,
ADD COLUMN "fields" JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN "compatibility" JSONB;

ALTER TABLE "SlateConfigSchema"
ADD CONSTRAINT "hub_config_schema_v2_shape_check" CHECK (
  ("version" = 1 AND "descriptorHash" IS NULL)
  OR
  ("version" = 2 AND "descriptorHash" ~ '^[a-f0-9]{64}$' AND "compatibility" IS NULL)
);

ALTER TABLE "SlateInstanceConfig"
ADD COLUMN "generation" INTEGER;

WITH ranked AS (
  SELECT "oid", ROW_NUMBER() OVER (
    PARTITION BY "instanceOid" ORDER BY "createdAt" ASC, "oid" ASC
  )::INTEGER AS generation
  FROM "SlateInstanceConfig"
)
UPDATE "SlateInstanceConfig" AS config
SET "generation" = ranked.generation
FROM ranked
WHERE config."oid" = ranked."oid";

ALTER TABLE "SlateInstanceConfig"
ALTER COLUMN "generation" SET DEFAULT 1,
ALTER COLUMN "generation" SET NOT NULL;

CREATE UNIQUE INDEX "hub_instance_config_generation_key"
ON "SlateInstanceConfig" ("instanceOid", "generation");

ALTER TABLE "SlateTriggerRegistrationOutbox"
ADD COLUMN "configGeneration" INTEGER,
ADD COLUMN "configSecretVersionBindings" JSONB;
