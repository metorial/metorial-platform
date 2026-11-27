import { db } from '@metorial-subspace/db';
import { aggregateUsageHour, floorToHour } from './rollup';
import { USAGE_WINDOW_DAYS } from './stats';

let HOUR_MS = 60 * 60 * 1000;
let UNROLLED_HOURS = 2;

type UsageScope = { instanceOid: bigint; providerOid: bigint };

let unrolledSince = () => new Date(floorToHour(new Date()).getTime() - HOUR_MS);

export let hasObservedUsage = async (d: UsageScope) => {
  let rolled = await db.providerToolUsageHourly.findFirst({
    where: {
      instanceOid: d.instanceOid,
      providerOid: d.providerOid,
      hour: { gte: new Date(Date.now() - USAGE_WINDOW_DAYS * 24 * HOUR_MS) },
      calls: { gt: 0 }
    },
    select: { toolKey: true }
  });
  if (rolled) return true;

  let recent = await db.$queryRaw<{ found: number }[]>`
    SELECT 1 AS "found"
    FROM "ToolCall" tc
    JOIN "ProviderRun" pr ON pr."oid" = tc."providerRunOid"
    WHERE tc."instanceOid" = ${d.instanceOid}
      AND pr."providerOid" = ${d.providerOid}
      AND tc."createdAt" >= ${unrolledSince()}
    LIMIT 1
  `;

  return recent.length > 0;
};

export let refreshRecentUsage = async (d: UsageScope) => {
  let current = floorToHour(new Date()).getTime();

  for (let i = UNROLLED_HOURS - 1; i >= 0; i--) {
    await aggregateUsageHour({ hour: new Date(current - i * HOUR_MS), scope: d });
  }
};
