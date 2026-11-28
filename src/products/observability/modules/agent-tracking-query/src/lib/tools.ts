import { countOf } from './money';
import { individualsHiddenError } from './privacy';
import { distinctCappedWarning } from './queries';
import { queryRange, type ResolvedRange } from './range';
import { warned, type UsageResult } from './scope';
import type { Cells } from './spend';
import type {
  AgentTrackingMcpServerUsage,
  AgentTrackingMcpServerUsageItem,
  AgentTrackingMcpToolUsage,
  AgentTrackingProvider,
  AgentTrackingSkill,
  AgentTrackingSkillUsage,
  AgentTrackingSkillUsageItem,
  AgentTrackingToolCallFigures
} from './types';

export let maxSkills = 500;

export let maxMcpServers = 500;

export let maxMcpTools = 2000;

let maxMcpServerProviders = 2000;

export let maxSkillDeviceRows = 10_000;

let userLevelSkillSources = new Set(['user', 'usersettings']);

export let toolsHiddenError = individualsHiddenError({
  message:
    'This organization hides individual data in agent usage, so usage is not broken down by skill or MCP server: one can be used by too few people.'
});

let mcpWhere = { field: 'tool.kind', op: 'eq', value: 'mcp' };

type CallColumns = {
  calls: string;
  failed: string;
  errorRate: string;
  members: string;
  lastUsed: string;
};

let groupColumns: CallColumns = {
  calls: 'tool_calls',
  failed: 'tool_calls.failed',
  errorRate: 'tool_calls.error_rate',
  members: 'users.active',
  lastUsed: 'last_used'
};

let mcpSummaryColumns: CallColumns = {
  calls: 'mcp_calls',
  failed: 'mcp_calls.failed',
  errorRate: 'mcp_calls.error_rate',
  members: 'mcp_calls.users',
  lastUsed: 'mcp_calls.last_used'
};

let callMeasures = Object.values(groupColumns);

let recordQuery = (dataset: string, range: ResolvedRange) => ({
  atq: '0',
  dataset,
  range: queryRange(range),
  timeZone: range.timeZone,
  labels: false
});

// Groups whose activations all carry a placeholder name are left out.
export let skillUsageQuery = (range: ResolvedRange) => ({
  ...recordQuery('skill_activations', range),
  dimensions: [{ field: 'skill.name', missing: 'exclude' }],
  measures: ['skill_activations.named', 'users.active', 'last_used'],
  having: { field: 'skill_activations.named', op: 'gt', value: 0 },
  orderBy: [{ by: 'skill_activations.named', direction: 'desc' }],
  limit: maxSkills
});

export let skillDevicesQuery = (range: ResolvedRange) => ({
  ...recordQuery('skill_activations', range),
  dimensions: [
    { field: 'skill.name', missing: 'exclude' },
    { field: 'skill.source', missing: 'null' },
    { field: 'device', missing: 'null' }
  ],
  measures: ['skill_activations.named'],
  orderBy: [{ by: 'skill_activations.named', direction: 'desc' }],
  limit: maxSkillDeviceRows
});

// Metorial Desktop installs skills only into the user's own skill folders, so a name also reported
// from a project, plugin or built-in skill, or from no known device, can be another skill.
export let skillDevicesOf = (result: UsageResult) => {
  let devicesByName = new Map<string, Set<string>>();
  if (result.meta?.truncated) return devicesByName;

  let unlinkable = new Set<string>();
  for (let row of result.rows) {
    let name = nameOf(row['skill.name']);
    if (!name) continue;

    let source = nameOf(row['skill.source']);
    let device = nameOf(row.device);
    if (!device || (source && !userLevelSkillSources.has(source.toLowerCase()))) {
      unlinkable.add(name);
      continue;
    }

    devicesByName.set(name, (devicesByName.get(name) ?? new Set()).add(device));
  }

  for (let name of unlinkable) devicesByName.delete(name);

  return devicesByName;
};

export let skillSummaryQuery = (range: ResolvedRange) => ({
  ...recordQuery('skill_activations', range),
  measures: ['skill_activations', 'skill_activations.named', 'users.active']
});

export let mcpServerUsageQuery = (range: ResolvedRange) => ({
  ...recordQuery('tool_calls', range),
  where: mcpWhere,
  dimensions: [{ field: 'mcp.server', missing: 'exclude' }],
  measures: callMeasures,
  orderBy: [{ by: 'tool_calls', direction: 'desc' }],
  limit: maxMcpServers
});

export let mcpToolUsageQuery = (range: ResolvedRange) => ({
  ...recordQuery('tool_calls', range),
  where: mcpWhere,
  dimensions: [
    { field: 'mcp.server', missing: 'exclude' },
    { field: 'mcp.tool', missing: 'exclude' }
  ],
  measures: callMeasures,
  orderBy: [{ by: 'tool_calls', direction: 'desc' }],
  limit: maxMcpTools
});

export let mcpServerProvidersQuery = (range: ResolvedRange) => ({
  ...recordQuery('tool_calls', range),
  where: mcpWhere,
  dimensions: [
    { field: 'mcp.server', missing: 'exclude' },
    { field: 'metorial.provider', missing: 'exclude' }
  ],
  measures: ['tool_calls'],
  orderBy: [{ by: 'tool_calls', direction: 'desc' }],
  limit: maxMcpServerProviders
});

// A server name can stand for different providers in different agent configurations, so only
// a name whose stamped calls all reached one provider gets it. A cut-off result could hide a
// second provider, so it gives none.
export let serverProviderIdsOf = (result: UsageResult) => {
  let idsByServer = new Map<string, Set<string>>();
  if (result.meta?.truncated) return new Map<string, string>();

  for (let row of result.rows) {
    let server = nameOf(row['mcp.server']);
    let providerId = nameOf(row['metorial.provider']);
    if (!server || !providerId) continue;

    idsByServer.set(server, (idsByServer.get(server) ?? new Set()).add(providerId));
  }

  return new Map(
    [...idsByServer].flatMap(([server, ids]) =>
      ids.size == 1 ? [[server, [...ids][0]!] as const] : []
    )
  );
};

export let mcpSummaryQuery = (range: ResolvedRange) => ({
  ...recordQuery('tool_calls', range),
  measures: [...Object.values(mcpSummaryColumns), 'mcp_calls.named']
});

let dateOf = (value: unknown) => {
  if (typeof value != 'string' && !(value instanceof Date)) return null;

  let date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

let nameOf = (value: unknown) => (typeof value == 'string' && value ? value : null);

let rateOf = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) ? value : null;

let figuresOf = (row: Cells, columns: CallColumns): AgentTrackingToolCallFigures => ({
  calls: countOf(row[columns.calls]),
  failed: countOf(row[columns.failed]),
  errorRate: rateOf(row[columns.errorRate]),
  members: countOf(row[columns.members]),
  lastUsedAt: dateOf(row[columns.lastUsed])
});

export let mcpSummaryOf = (
  result: UsageResult,
  countsCapped: boolean
): AgentTrackingMcpServerUsage['summary'] => {
  let row = result.rows[0] ?? {};

  return {
    ...figuresOf(row, mcpSummaryColumns),
    namedCalls: countOf(row['mcp_calls.named']),
    countsCapped
  };
};

export let skillSummaryOf = (
  result: UsageResult,
  countsCapped: boolean
): AgentTrackingSkillUsage['summary'] => {
  let row = result.rows[0] ?? {};

  return {
    activations: countOf(row.skill_activations),
    namedActivations: countOf(row['skill_activations.named']),
    members: countOf(row['users.active']),
    countsCapped
  };
};

export let skillItemsOf = (
  result: UsageResult,
  skills?: Map<string, AgentTrackingSkill>
): AgentTrackingSkillUsageItem[] =>
  result.rows.flatMap(row => {
    let name = nameOf(row['skill.name']);
    if (!name) return [];

    return [
      {
        name,
        skill: skills?.get(name) ?? null,
        activations: countOf(row['skill_activations.named']),
        members: countOf(row['users.active']),
        lastUsedAt: dateOf(row.last_used)
      }
    ];
  });

export let mcpServerItemsOf = (d: {
  servers: UsageResult;
  tools: UsageResult;
  providers?: Map<string, AgentTrackingProvider>;
}): AgentTrackingMcpServerUsageItem[] => {
  let toolsByServer = new Map<string, AgentTrackingMcpToolUsage[]>();
  for (let row of d.tools.rows) {
    let server = nameOf(row['mcp.server']);
    let tool = nameOf(row['mcp.tool']);
    if (!server || !tool) continue;

    let tools = toolsByServer.get(server) ?? [];
    tools.push({ name: tool, ...figuresOf(row, groupColumns) });
    toolsByServer.set(server, tools);
  }

  return d.servers.rows.flatMap(row => {
    let name = nameOf(row['mcp.server']);
    if (!name) return [];

    return [
      {
        name,
        provider: d.providers?.get(name) ?? null,
        ...figuresOf(row, groupColumns),
        tools: toolsByServer.get(name) ?? []
      }
    ];
  });
};

export let anyTruncated = (results: UsageResult[]) =>
  results.some(result => !!result.meta?.truncated);

export let anyDistinctCapped = (results: UsageResult[]) =>
  results.some(result => warned(result, distinctCappedWarning));
