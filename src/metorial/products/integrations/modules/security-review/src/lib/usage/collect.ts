import {
  db,
  type SecurityReviewRevision,
  type SecurityUsageSnapshot
} from '@metorial-subspace/db';
import {
  buildIntegrationProviderToolFilterChain,
  checkToolAccess,
  normalizeToolFilterChain
} from '@metorial-subspace/module-provider-internal';
import { loadSpecification } from '../subjects/specification';
import {
  buildUsageStats,
  countSevereProtoGuardMatches,
  USAGE_WINDOW_DAYS,
  type UsageCatalogTool,
  usageDeterministicFindings
} from './stats';

let HOUR_MS = 60 * 60 * 1000;
let MAX_FILTER_COMBINATIONS = 50;
let MAX_SCOPE_ROWS = 200;
let MAX_TOOL_FILTER_PAIRS = 30;

type FilterCombination = {
  providerFilter: PrismaJson.ToolFilter | null;
  instanceFilter: PrismaJson.ToolFilter | null;
  instanceOverride: boolean;
  groupFilter: PrismaJson.ToolFilter | null;
  groupOverride: boolean;
  canAttach: boolean;
  canOverride: boolean;
};

let loadFilterCombinations = async (d: { instanceOid: bigint; providerOid: bigint }) =>
  db.$queryRaw<FilterCombination[]>`
    SELECT DISTINCT
      COALESCE(ipvr."toolFilter", ip."toolFilter") AS "providerFilter",
      ipv."toolFilter" AS "instanceFilter",
      COALESCE(ipv."isOverrideToolFilter", false) AS "instanceOverride",
      gp."toolFilter" AS "groupFilter",
      COALESCE(gp."isOverrideToolFilter", false) AS "groupOverride",
      i."canAttachCustomToolFilters" AS "canAttach",
      i."canOverrideToolFilters" AS "canOverride"
    FROM "IntegrationInstanceProvider" iip
    JOIN "IntegrationProvider" ip ON ip."oid" = iip."integrationProviderOid"
    JOIN "Integration" i ON i."oid" = iip."integrationOid"
    LEFT JOIN "IntegrationInstanceProviderVersion" ipv ON ipv."oid" = iip."currentVersionOid"
    LEFT JOIN "IntegrationProviderVersion" ipvr ON ipvr."oid" = ipv."integrationProviderVersionOid"
    LEFT JOIN "IntegrationInstanceGroupProvider" gp
      ON gp."integrationInstanceProviderOid" = iip."oid" AND gp."status" = 'active'
    WHERE iip."instanceOid" = ${d.instanceOid}
      AND iip."status" = 'active'
      AND ip."providerOid" = ${d.providerOid}
    LIMIT ${MAX_FILTER_COMBINATIONS}
  `;

let loadScopeCounts = async (d: { instanceOid: bigint; providerOid: bigint }) =>
  db.$queryRaw<{ scope: string; authConfigs: number }[]>`
    SELECT s."scope" AS "scope", count(*)::int AS "authConfigs"
    FROM "ProviderAuthConfig" ac,
      jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(ac."scopes") = 'array' THEN ac."scopes" ELSE '[]'::jsonb END
      ) AS s("scope")
    WHERE ac."instanceOid" = ${d.instanceOid}
      AND ac."providerOid" = ${d.providerOid}
      AND ac."status" = 'active'
    GROUP BY s."scope"
    ORDER BY 2 DESC
    LIMIT ${MAX_SCOPE_ROWS}
  `;

let loadDailyCalls = async (d: { instanceOid: bigint; providerOid: bigint; since: Date }) =>
  db.$queryRaw<{ day: Date; calls: number; errors: number }[]>`
    SELECT date_trunc('day', "hour") AS "day",
      sum("calls")::int AS "calls",
      sum("errors")::int AS "errors"
    FROM "ProviderToolUsageHourly"
    WHERE "instanceOid" = ${d.instanceOid}
      AND "providerOid" = ${d.providerOid}
      AND "hour" >= ${d.since}
    GROUP BY 1
    ORDER BY 1
  `;

export let collectUsageEvidence = async (d: {
  review: { instanceOid: bigint; providerOid: bigint };
  baseRevision: Pick<SecurityReviewRevision, 'id' | 'report' | 'specificationOid'>;
}) => {
  let { instanceOid, providerOid } = d.review;
  let since = new Date(Date.now() - USAGE_WINDOW_DAYS * 24 * HOUR_MS);
  let rollupWhere = { instanceOid, providerOid, hour: { gte: since } };

  let [
    specificationTools,
    specification,
    combinations,
    toolUsage,
    protoguard,
    protoguardPairs,
    scopeCounts,
    daily,
    authConfigs,
    configs
  ] = await Promise.all([
    d.baseRevision.specificationOid
      ? db.providerTool.findMany({
          where: { specificationOid: d.baseRevision.specificationOid }
        })
      : [],
    loadSpecification(d.baseRevision.specificationOid),
    loadFilterCombinations({ instanceOid, providerOid }),
    db.providerToolUsageHourly.groupBy({
      by: ['toolKey'],
      where: rollupWhere,
      _sum: { calls: true, errors: true }
    }),
    db.providerProtoGuardHourly.groupBy({
      by: ['filterKey', 'issueType', 'severity'],
      where: rollupWhere,
      _sum: { matches: true, alerts: true }
    }),
    db.providerProtoGuardHourly.groupBy({
      by: ['toolKey', 'filterKey'],
      where: rollupWhere,
      _sum: { matches: true },
      orderBy: { _sum: { matches: 'desc' } },
      take: MAX_TOOL_FILTER_PAIRS
    }),
    loadScopeCounts({ instanceOid, providerOid }),
    loadDailyCalls({ instanceOid, providerOid, since }),
    db.providerAuthConfig.count({ where: { instanceOid, providerOid, status: 'active' } }),
    db.providerConfig.count({ where: { instanceOid, providerOid, status: 'active' } })
  ]);

  let chains = combinations.length
    ? combinations.map(combination =>
        normalizeToolFilterChain(
          buildIntegrationProviderToolFilterChain({
            canAttachCustomToolFilters: combination.canAttach,
            canOverrideToolFilters: combination.canOverride,
            integrationProviderToolFilter: combination.providerFilter,
            integrationInstanceProviderToolFilter: combination.instanceFilter,
            integrationInstanceProviderIsOverride: combination.instanceOverride,
            integrationInstanceGroupProviderToolFilter: combination.groupFilter,
            integrationInstanceGroupProviderIsOverride: combination.groupOverride
          })
        )
      )
    : [[]];

  let baseTags = new Map(
    (d.baseRevision.report?.capabilities?.tools ?? []).map(tool => [tool.key, tool.tags])
  );

  let catalog: UsageCatalogTool[] = specificationTools.map(tool => ({
    key: tool.key,
    tags: baseTags.get(tool.key) ?? [],
    scopes: (tool.value.scopes?.AND ?? []).flatMap(clause => clause.OR),
    allowed: chains.some(chain => checkToolAccess(tool, chain, 'call').allowed)
  }));

  let stats = buildUsageStats({
    catalog,
    toolUsage: toolUsage.map(row => ({
      key: row.toolKey,
      calls: row._sum.calls ?? 0,
      errors: row._sum.errors ?? 0
    })),
    scopeCounts,
    protoguard: protoguard.map(row => ({
      filter: row.filterKey,
      issueType: row.issueType,
      severity: row.severity,
      matches: row._sum.matches ?? 0,
      alerts: row._sum.alerts ?? 0
    })),
    authConfigs,
    configs
  });

  let deterministic = usageDeterministicFindings(stats);

  let snapshot: SecurityUsageSnapshot = {
    takenAt: new Date().toISOString(),
    baseRevisionId: d.baseRevision.id,
    calls: stats.calls,
    toolsUsed: stats.tools.filter(tool => tool.calls > 0).map(tool => tool.key),
    allowedTools: stats.tools.filter(tool => tool.allowed).map(tool => tool.key),
    scopes: stats.scopes.map(scope => scope.scope),
    authConfigs: stats.authConfigs,
    configs: stats.configs,
    severeProtoGuardMatches: countSevereProtoGuardMatches(stats)
  };

  let json = (value: unknown) => JSON.stringify(value, null, 2);
  let baseReport = d.baseRevision.report;

  let files: Record<string, string> = {
    'base/report.json': json({
      summary: baseReport?.summary ?? null,
      capabilities: baseReport?.capabilities?.tools ?? [],
      findings: (baseReport?.findings ?? []).map(finding => ({
        key: finding.key,
        severity: finding.severity,
        category: finding.category,
        title: finding.title,
        body: finding.body,
        tools: finding.tools
      }))
    }),
    'usage/overview.json': json({
      windowDays: stats.windowDays,
      calls: stats.calls,
      errors: stats.errors,
      activeAuthConfigs: stats.authConfigs,
      activeConfigs: stats.configs,
      toolsAllowed: snapshot.allowedTools.length,
      toolsUsed: snapshot.toolsUsed.length
    }),
    'usage/tools.json': json(stats.tools),
    'usage/scopes.json': json(stats.scopes),
    'usage/protoguard.json': json({
      matches: stats.protoguard.matches,
      alerts: stats.protoguard.alerts,
      filters: stats.protoguard.filters,
      topToolFilterPairs: protoguardPairs.map(row => ({
        tool: row.toolKey,
        filter: row.filterKey,
        matches: row._sum.matches ?? 0
      }))
    }),
    'usage/daily.json': json(
      daily.map(row => ({
        day: row.day.toISOString().slice(0, 10),
        calls: row.calls,
        errors: row.errors
      }))
    ),
    'usage/tool-filters.json': json({
      filterCombinations: combinations.length,
      blockedTools: catalog.filter(tool => !tool.allowed).map(tool => tool.key)
    }),
    ...Object.fromEntries(
      Object.entries(specification?.files ?? {}).map(([path, content]) => [
        `provider/${path}`,
        content
      ])
    )
  };

  return {
    stats,
    snapshot,
    files,
    facts: deterministic.facts,
    findings: deterministic.findings
  };
};

export type CollectedUsage = Awaited<ReturnType<typeof collectUsageEvidence>>;
