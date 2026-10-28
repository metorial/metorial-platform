import type {
  SecurityCapabilityTag,
  SecurityReportFinding,
  SecurityUsageProtoGuardStat,
  SecurityUsageScopeStat,
  SecurityUsageStats,
  SecurityUsageToolStat
} from '@metorial-subspace/db';
import type { LedgerFact } from '@metorial/review-engine';
import { isMutatingTag } from '../evidence';

export let USAGE_WINDOW_DAYS = 30;
export let MAX_TOOL_STATS = 100;
export let MAX_SCOPE_STATS = 100;
export let MAX_PROTOGUARD_STATS = 50;

let SEVERE_PROTOGUARD_SEVERITIES = ['high', 'critical'];

export type UsageCatalogTool = {
  key: string;
  tags: SecurityCapabilityTag[];
  scopes: string[];
  allowed: boolean;
};

export type UsageStatsInput = {
  catalog: UsageCatalogTool[];
  toolUsage: { key: string; calls: number; errors: number }[];
  scopeCounts: { scope: string; authConfigs: number }[];
  protoguard: (SecurityUsageProtoGuardStat & { alerts: number })[];
  authConfigs: number;
  configs: number;
};

export let buildUsageStats = (d: UsageStatsInput): SecurityUsageStats => {
  let catalog = new Map(d.catalog.map(tool => [tool.key, tool]));
  let usage = new Map(d.toolUsage.map(row => [row.key, row]));

  let tools: SecurityUsageToolStat[] = [...new Set([...catalog.keys(), ...usage.keys()])]
    .map(key => ({
      key,
      calls: usage.get(key)?.calls ?? 0,
      errors: usage.get(key)?.errors ?? 0,
      allowed: catalog.get(key)?.allowed ?? false,
      tags: catalog.get(key)?.tags ?? []
    }))
    .sort((a, b) => b.calls - a.calls || a.key.localeCompare(b.key));

  let usedScopeIds = new Set(
    tools.filter(tool => tool.calls > 0).flatMap(tool => catalog.get(tool.key)?.scopes ?? [])
  );

  let scopes: SecurityUsageScopeStat[] = d.scopeCounts
    .map(row => ({
      scope: row.scope,
      authConfigs: row.authConfigs,
      requiredByUsedTool: usedScopeIds.has(row.scope)
    }))
    .sort((a, b) => b.authConfigs - a.authConfigs || a.scope.localeCompare(b.scope));

  return {
    windowDays: USAGE_WINDOW_DAYS,
    calls: tools.reduce((sum, tool) => sum + tool.calls, 0),
    errors: tools.reduce((sum, tool) => sum + tool.errors, 0),
    authConfigs: d.authConfigs,
    configs: d.configs,
    tools: tools.slice(0, MAX_TOOL_STATS),
    scopes: scopes.slice(0, MAX_SCOPE_STATS),
    protoguard: {
      matches: d.protoguard.reduce((sum, row) => sum + row.matches, 0),
      alerts: d.protoguard.reduce((sum, row) => sum + row.alerts, 0),
      filters: d.protoguard
        .map(({ alerts: _alerts, ...row }) => row)
        .sort((a, b) => b.matches - a.matches)
        .slice(0, MAX_PROTOGUARD_STATS)
    }
  };
};

export let countSevereProtoGuardMatches = (stats: SecurityUsageStats) =>
  stats.protoguard.filters
    .filter(filter => SEVERE_PROTOGUARD_SEVERITIES.includes(filter.severity))
    .reduce((sum, filter) => sum + filter.matches, 0);

export let usageDeterministicFindings = (stats: SecurityUsageStats) => {
  let facts: LedgerFact[] = [];
  let findings: SecurityReportFinding[] = [];

  let outsideFilter = stats.tools.filter(tool => !tool.allowed && tool.calls > 0);
  if (outsideFilter.length) {
    facts.push({
      id: 'usage-outside-filter',
      title: 'Calls to tools the current filters block',
      detail: outsideFilter.map(tool => `${tool.key}: ${tool.calls} calls`).join('; ')
    });

    findings.push({
      key: 'usage-calls-outside-filter',
      kind: 'security',
      category: 'capability',
      severity: 'medium',
      title: 'Tools that are now blocked were called in the observed window',
      body: `Within the last ${stats.windowDays} days, ${outsideFilter.length} tool${outsideFilter.length == 1 ? ' was' : 's were'} called that the current tool filters no longer allow. The filters were likely tightened recently; earlier calls may have reached more than is allowed today.`,
      recommendation: 'Review what those calls did and keep the tool filter tightened.',
      tools: outsideFilter.map(tool => tool.key),
      evidence: [{ type: 'fact', id: 'usage-outside-filter' }]
    });
  }

  let unusedMutating = stats.tools.filter(
    tool => tool.allowed && tool.calls == 0 && tool.tags.some(isMutatingTag)
  );
  if (stats.calls > 0 && unusedMutating.length) {
    facts.push({
      id: 'usage-unused-mutating',
      title: 'Allowed state-changing tools that were never called',
      detail: unusedMutating.map(tool => tool.key).join(', ')
    });

    findings.push({
      key: 'usage-unused-mutating-tools',
      kind: 'capability',
      category: 'over_privilege',
      severity: 'low',
      title: 'State-changing tools are available but unused',
      body: `${unusedMutating.length} tool${unusedMutating.length == 1 ? ' that can change' : 's that can change'} data in the connected account ${unusedMutating.length == 1 ? 'is' : 'are'} allowed but were not called in the last ${stats.windowDays} days.`,
      recommendation: 'Block tools you do not need with a tool filter on the integration.',
      tools: unusedMutating.map(tool => tool.key),
      evidence: [{ type: 'fact', id: 'usage-unused-mutating' }]
    });
  }

  let unusedScopes = stats.scopes.filter(scope => !scope.requiredByUsedTool);
  if (stats.calls > 0 && unusedScopes.length) {
    facts.push({
      id: 'usage-unused-scopes',
      title: 'Granted scopes no called tool needs',
      detail: unusedScopes.map(scope => scope.scope).join(', ')
    });

    findings.push({
      key: 'usage-unused-scopes',
      kind: 'capability',
      category: 'excessive_scope',
      severity: 'low',
      title: 'Some granted scopes are not needed by the tools in use',
      body: `${unusedScopes.length} granted scope${unusedScopes.length == 1 ? ' is' : 's are'} not required by any tool called in the last ${stats.windowDays} days.`,
      recommendation:
        'Request only the scopes the tools you use need when connecting accounts.',
      tools: [],
      evidence: [{ type: 'fact', id: 'usage-unused-scopes' }]
    });
  }

  return { facts, findings };
};
