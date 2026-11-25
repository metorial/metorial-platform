import { formatNumber, formatPercent } from '@metorial/chart';
import type {
  DashboardInstanceAgentTrackingToolsMcpServersOutput,
  DashboardInstanceAgentTrackingToolsSkillsOutput
} from '@metorial/dashboard-sdk';
import { serializeCsvExport, shareCell } from './csv';
import { counted } from './spendSummary';

export type McpServerUsage = DashboardInstanceAgentTrackingToolsMcpServersOutput;

export type McpServerItem = McpServerUsage['items'][number];

export type McpToolItem = McpServerItem['tools'][number];

export type SkillUsage = DashboardInstanceAgentTrackingToolsSkillsOutput;

export type SkillItem = SkillUsage['items'][number];

export let toolSortIds = ['name', 'calls', 'error_rate', 'members', 'last_used'] as const;

export type ToolSort = (typeof toolSortIds)[number];

export type SortOrder = 'asc' | 'desc';

type SortableRow = {
  name: string;
  calls: number;
  errorRate: number | null;
  members: number;
  lastUsedAt: Date | string | null;
};

let timeOf = (value: Date | string | null) => (value ? new Date(value).getTime() : null);

let valueOf = (row: SortableRow, sort: ToolSort): number | string | null => {
  switch (sort) {
    case 'name':
      return row.name.toLowerCase();
    case 'calls':
      return row.calls;
    case 'error_rate':
      return row.errorRate;
    case 'members':
      return row.members;
    case 'last_used':
      return timeOf(row.lastUsedAt);
  }
};

// Missing values sort last in both directions; ties keep the most used first.
export let sortToolRows = <Row extends SortableRow>(
  rows: Row[],
  sort: ToolSort,
  order: SortOrder
) =>
  [...rows].sort((a, b) => {
    let left = valueOf(a, sort);
    let right = valueOf(b, sort);

    if (left !== right) {
      if (left === null) return 1;
      if (right === null) return -1;

      let compared = left < right ? -1 : 1;
      return order == 'asc' ? compared : -compared;
    }

    return b.calls - a.calls || a.name.localeCompare(b.name);
  });

export let skillSortRows = (items: SkillItem[]): (SkillItem & SortableRow)[] =>
  items.map(item => ({
    ...item,
    calls: item.activations,
    errorRate: null
  }));

export let defaultSortOrder = (sort: ToolSort): SortOrder => (sort == 'name' ? 'asc' : 'desc');

export let formatRate = (rate: number | null) =>
  rate === null ? '—' : formatPercent(rate, { precision: rate > 0 && rate < 0.001 ? 2 : 1 });

// The API says only that a member count reached its cap, which is then the largest count shown.
export let membersFormatter = (capped: boolean, counts: number[]) => {
  let cap = capped ? Math.max(0, ...counts) : null;

  return (members: number) => `${formatNumber(members)}${cap && members == cap ? '+' : ''}`;
};

export let unnamedNotice = (d: {
  total: number;
  named: number;
  unit: string;
  name: string;
}) => {
  let unnamed = d.total - d.named;
  if (unnamed <= 0) return null;

  return `${counted(unnamed, d.unit)} came without a ${d.name}, so ${unnamed == 1 ? 'it is' : 'they are'} counted above but not listed.`;
};

let dateCell = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);

let rangeRows = (usage: { range: { from: Date; to: Date; timeZone: string } }) => [
  ['From', new Date(usage.range.from).toISOString()],
  ['To', new Date(usage.range.to).toISOString()],
  ['Time Zone', usage.range.timeZone],
  ['Source', 'Agent telemetry']
];

export let toolsCsvFileName = (kind: 'mcp' | 'skills', range: { from: Date; to: Date }) => {
  let day = (value: Date) => new Date(value).toISOString().slice(0, 10);

  return `agent-usage-${kind == 'mcp' ? 'mcp-servers' : 'skills'}-${day(range.from)}-to-${day(range.to)}.csv`;
};

export let buildMcpServersCsv = (usage: McpServerUsage) =>
  serializeCsvExport([
    ...rangeRows(usage),
    ['MCP Tool Calls', usage.summary.calls],
    ['MCP Tool Calls Without a Server Name', usage.summary.calls - usage.summary.namedCalls],
    [],
    ['Server', 'Tool', 'Calls', 'Failed', 'Error Rate (%)', 'Members', 'Last Used'],
    ...usage.items.flatMap(server => {
      let row = (item: McpServerItem | McpToolItem, tool: string | null) => [
        server.name,
        tool,
        item.calls,
        item.failed,
        shareCell(item.errorRate),
        item.members,
        dateCell(item.lastUsedAt)
      ];

      return [row(server, null), ...server.tools.map(tool => row(tool, tool.name))];
    })
  ]);

export let buildSkillsCsv = (usage: SkillUsage) =>
  serializeCsvExport([
    ...rangeRows(usage),
    ['Skill Activations', usage.summary.activations],
    [
      'Skill Activations Without a Skill Name',
      usage.summary.activations - usage.summary.namedActivations
    ],
    [],
    ['Skill', 'Activations', 'Members', 'Last Used'],
    ...usage.items.map(item => [
      item.name,
      item.activations,
      item.members,
      dateCell(item.lastUsedAt)
    ])
  ]);
