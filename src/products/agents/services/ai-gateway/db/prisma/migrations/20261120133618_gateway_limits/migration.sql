-- AlterTable
ALTER TABLE "GatewayToken" ALTER COLUMN "limits" SET DEFAULT '[]';

-- Token limits move from fixed fields to a list of { metric, amount, interval } entries.
UPDATE "GatewayToken"
SET "limits" = (
  SELECT COALESCE(jsonb_agg(entry), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object('metric', 'requests', 'amount', ("limits"->>'requestsPerMinute')::numeric, 'interval', '1m') AS entry
    WHERE "limits" ? 'requestsPerMinute'
    UNION ALL
    SELECT jsonb_build_object('metric', 'tokens', 'amount', ("limits"->>'tokensPerMinute')::numeric, 'interval', '1m')
    WHERE "limits" ? 'tokensPerMinute'
    UNION ALL
    SELECT jsonb_build_object('metric', 'spend_usd', 'amount', ("limits"->>'monthlySpendLimitUsd')::numeric, 'interval', '1mo')
    WHERE "limits" ? 'monthlySpendLimitUsd'
  ) entries
)
WHERE jsonb_typeof("limits") = 'object';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "platformLimits" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "platformLimitsSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "limits" JSONB NOT NULL DEFAULT '[]';
