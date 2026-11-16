import { db, Prisma } from '@metorial-subspace/db';

let HOUR_MS = 60 * 60 * 1000;

export type UsageRollupScope = { instanceOid: bigint; providerOid: bigint };

export let floorToHour = (date: Date) =>
  new Date(Math.floor(date.getTime() / HOUR_MS) * HOUR_MS);

export let aggregateToolUsageHour = async (d: { hour: Date; scope?: UsageRollupScope }) => {
  let from = d.hour;
  let to = new Date(d.hour.getTime() + HOUR_MS);
  let scope = d.scope
    ? Prisma.sql`AND tc."instanceOid" = ${d.scope.instanceOid} AND pr."providerOid" = ${d.scope.providerOid}`
    : Prisma.empty;

  await db.$executeRaw`
    INSERT INTO "ProviderToolUsageHourly"
      ("instanceOid", "providerOid", "hour", "toolKey", "calls", "errors", "tenantOid", "projectOid")
    SELECT
      tc."instanceOid",
      pr."providerOid",
      ${from}::timestamp,
      tc."toolKey",
      count(*)::int,
      (count(*) FILTER (WHERE sm."status" = 'failed'))::int,
      min(tc."tenantOid"),
      min(tc."projectOid")
    FROM "ToolCall" tc
    JOIN "ProviderRun" pr ON pr."oid" = tc."providerRunOid"
    JOIN "SessionMessage" sm ON sm."oid" = tc."messageOid"
    WHERE tc."createdAt" >= ${from}
      AND tc."createdAt" < ${to}
      AND tc."instanceOid" IS NOT NULL
      AND tc."projectOid" IS NOT NULL
      ${scope}
    GROUP BY tc."instanceOid", pr."providerOid", tc."toolKey"
    ON CONFLICT ("instanceOid", "providerOid", "hour", "toolKey")
    DO UPDATE SET
      "calls" = EXCLUDED."calls",
      "errors" = EXCLUDED."errors",
      "updatedAt" = now()
  `;
};

export let aggregateProtoGuardHour = async (d: { hour: Date; scope?: UsageRollupScope }) => {
  let from = d.hour;
  let to = new Date(d.hour.getTime() + HOUR_MS);
  let scope = d.scope
    ? Prisma.sql`AND pa."instanceOid" = ${d.scope.instanceOid} AND pr."providerOid" = ${d.scope.providerOid}`
    : Prisma.empty;

  await db.$executeRaw`
    INSERT INTO "ProviderProtoGuardHourly"
      ("instanceOid", "providerOid", "hour", "toolKey", "filterKey", "direction",
       "issueType", "severity", "matches", "alerts", "suppressed", "tenantOid", "projectOid")
    SELECT
      pa."instanceOid",
      pr."providerOid",
      ${from}::timestamp,
      COALESCE(sm."methodOrToolKey", ''),
      f."key",
      COALESCE(pai."direction"::text, 'unknown'),
      f."issueType",
      f."severity",
      (count(*) FILTER (WHERE NOT pai."isSuppressed"))::int,
      (count(DISTINCT pai."alertOid") FILTER (WHERE NOT pai."isSuppressed"))::int,
      (count(*) FILTER (WHERE pai."isSuppressed"))::int,
      min(pa."tenantOid"),
      min(pa."projectOid")
    FROM "ProtoGuardAlert" pa
    JOIN "ProtoGuardAlertInstance" pai ON pai."alertOid" = pa."oid"
    JOIN "ProtoGuardFilter" f ON f."oid" = pai."filterOid"
    JOIN "ProviderRun" pr ON pr."oid" = pa."providerRunOid"
    JOIN "SessionMessage" sm ON sm."oid" = pa."messageOid"
    WHERE pa."createdAt" >= ${from}
      AND pa."createdAt" < ${to}
      AND pai."stage" = 'active'
      AND pa."instanceOid" IS NOT NULL
      AND pa."projectOid" IS NOT NULL
      ${scope}
    GROUP BY
      pa."instanceOid", pr."providerOid", COALESCE(sm."methodOrToolKey", ''),
      f."key", COALESCE(pai."direction"::text, 'unknown'), f."issueType", f."severity"
    ON CONFLICT ("instanceOid", "providerOid", "hour", "toolKey", "filterKey", "direction")
    DO UPDATE SET
      "matches" = EXCLUDED."matches",
      "alerts" = EXCLUDED."alerts",
      "suppressed" = EXCLUDED."suppressed",
      "updatedAt" = now()
  `;
};

export let aggregateUsageHour = async (d: { hour: Date; scope?: UsageRollupScope }) => {
  await aggregateToolUsageHour(d);
  await aggregateProtoGuardHour(d);
};
