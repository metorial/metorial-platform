import { describe, expect, it } from 'vitest';
import {
  buildMcpServersCsv,
  buildSkillsCsv,
  formatRate,
  membersFormatter,
  skillSortRows,
  sortToolRows,
  toolsCsvFileName,
  unnamedNotice,
  type McpServerUsage,
  type SkillUsage
} from './toolsSummary';

let range = {
  preset: 'last_7_days',
  from: new Date('2026-11-16T00:00:00Z'),
  to: new Date('2026-11-22T12:00:00Z'),
  timeZone: 'UTC'
};

let figures = (calls: number, extra: Record<string, unknown> = {}) => ({
  calls,
  failed: 1,
  errorRate: calls ? 1 / calls : null,
  members: 2,
  lastUsedAt: new Date('2026-11-21T09:30:00Z'),
  ...extra
});

let mcpUsage = (): McpServerUsage => ({
  object: 'agent_tracking.mcp_server_usage',
  range,
  toolDetails: true,
  summary: {
    calls: 10,
    namedCalls: 7,
    failed: 2,
    errorRate: 0.2,
    members: 3,
    lastUsedAt: new Date('2026-11-21T09:30:00Z'),
    countsCapped: false
  },
  items: [
    {
      name: 'metorial-github',
      provider: { id: 'pro_github', name: 'GitHub' },
      ...figures(4),
      tools: [{ name: 'create_issue', ...figures(4) }]
    },
    { name: '=cmd', provider: null, ...figures(3), tools: [] }
  ],
  truncated: false
});

let skillUsage = (): SkillUsage => ({
  object: 'agent_tracking.skill_usage',
  range,
  toolDetails: false,
  summary: { activations: 5, namedActivations: 4, members: 2, countsCapped: false },
  items: [
    { name: 'pdf', activations: 3, members: 2, lastUsedAt: null },
    { name: 'docx', activations: 1, members: 1, lastUsedAt: new Date('2026-11-20T08:00:00Z') }
  ],
  truncated: false
});

describe('tool table sorting', () => {
  let rows = [
    { name: 'b', calls: 2, errorRate: 0.5, members: 1, lastUsedAt: null },
    {
      name: 'A',
      calls: 5,
      errorRate: null,
      members: 3,
      lastUsedAt: '2026-11-01'
    },
    { name: 'c', calls: 5, errorRate: 0.1, members: 2, lastUsedAt: '2026-11-03' }
  ];

  it('sorts by calls, most first, with ties by name', () => {
    expect(sortToolRows(rows, 'calls', 'desc').map(row => row.name)).toEqual(['A', 'c', 'b']);
    expect(sortToolRows(rows, 'calls', 'asc').map(row => row.name)).toEqual(['b', 'A', 'c']);
  });

  it('sorts names without case and keeps missing values last in both orders', () => {
    expect(sortToolRows(rows, 'name', 'asc').map(row => row.name)).toEqual(['A', 'b', 'c']);
    expect(sortToolRows(rows, 'error_rate', 'desc').map(row => row.name)).toEqual([
      'b',
      'c',
      'A'
    ]);
    expect(sortToolRows(rows, 'error_rate', 'asc').map(row => row.name)).toEqual([
      'c',
      'b',
      'A'
    ]);
    expect(sortToolRows(rows, 'last_used', 'desc').map(row => row.name)).toEqual([
      'c',
      'A',
      'b'
    ]);
  });

  it('sorts skills by activations', () => {
    expect(
      sortToolRows(skillSortRows(skillUsage().items), 'calls', 'desc').map(row => row.name)
    ).toEqual(['pdf', 'docx']);
  });
});

describe('tool usage text', () => {
  it('marks only the capped member count with a plus', () => {
    let capped = membersFormatter(true, [10_000, 12, 9]);
    expect([capped(10_000), capped(12)]).toEqual(['10,000+', '12']);
    expect(membersFormatter(false, [10_000])(10_000)).toBe('10,000');
  });

  it('formats rates and their absence', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(0.2)).toBe('20%');
    expect(formatRate(0.0005)).toBe('0.05%');
  });

  it('explains usage without a name', () => {
    let mcp = { unit: 'MCP tool call', name: 'server name' };
    let skills = { unit: 'skill activation', name: 'skill name' };

    expect(unnamedNotice({ total: 10, named: 7, ...mcp })).toBe(
      '3 MCP tool calls came without a server name, so they are counted above but not listed.'
    );
    expect(unnamedNotice({ total: 5, named: 4, ...skills })).toBe(
      '1 skill activation came without a skill name, so it is counted above but not listed.'
    );
    expect(unnamedNotice({ total: 5, named: 5, ...skills })).toBeNull();
  });
});

describe('tool usage CSV', () => {
  it('lists every server with its tools under it', () => {
    let lines = buildMcpServersCsv(mcpUsage()).replace('﻿', '').split('\r\n');

    expect(lines.slice(0, 6)).toEqual([
      'From,2026-11-16T00:00:00.000Z',
      'To,2026-11-22T12:00:00.000Z',
      'Time Zone,UTC',
      'Source,Agent telemetry',
      'MCP Tool Calls,10',
      'MCP Tool Calls Without a Server Name,3'
    ]);
    expect(lines.slice(7)).toEqual([
      'Server,Tool,Calls,Failed,Error Rate (%),Members,Last Used',
      'metorial-github,,4,1,25.00,2,2026-11-21T09:30:00.000Z',
      'metorial-github,create_issue,4,1,25.00,2,2026-11-21T09:30:00.000Z',
      "'=cmd,,3,1,33.33,2,2026-11-21T09:30:00.000Z",
      ''
    ]);
  });

  it('lists every skill', () => {
    let lines = buildSkillsCsv(skillUsage()).replace('﻿', '').split('\r\n');

    expect(lines.slice(4, 6)).toEqual([
      'Skill Activations,5',
      'Skill Activations Without a Skill Name,1'
    ]);
    expect(lines.slice(7)).toEqual([
      'Skill,Activations,Members,Last Used',
      'pdf,3,2,',
      'docx,1,1,2026-11-20T08:00:00.000Z',
      ''
    ]);
  });

  it('names the file after the view and range', () => {
    expect(toolsCsvFileName('mcp', range)).toBe(
      'agent-usage-mcp-servers-2026-11-16-to-2026-11-22.csv'
    );
    expect(toolsCsvFileName('skills', range)).toBe(
      'agent-usage-skills-2026-11-16-to-2026-11-22.csv'
    );
  });
});
