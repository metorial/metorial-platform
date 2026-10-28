import { describe, expect, it } from 'vitest';
import {
  buildUsageStats,
  countSevereProtoGuardMatches,
  usageDeterministicFindings
} from './stats';

let catalog = [
  { key: 'search', tags: ['read' as const], scopes: ['read:all'], allowed: true },
  {
    key: 'delete_item',
    tags: ['write' as const, 'destructive' as const],
    scopes: ['write:all'],
    allowed: true
  },
  { key: 'send_mail', tags: ['external_send' as const], scopes: ['mail'], allowed: false }
];

let build = (overrides: Partial<Parameters<typeof buildUsageStats>[0]> = {}) =>
  buildUsageStats({
    catalog,
    toolUsage: [{ key: 'search', calls: 40, errors: 2 }],
    scopeCounts: [
      { scope: 'read:all', authConfigs: 3 },
      { scope: 'write:all', authConfigs: 3 }
    ],
    protoguard: [],
    authConfigs: 3,
    configs: 4,
    ...overrides
  });

describe('buildUsageStats', () => {
  it('merges the catalog with observed usage and sorts by calls', () => {
    let stats = build();

    expect(stats.calls).toBe(40);
    expect(stats.errors).toBe(2);
    expect(stats.tools.map(tool => tool.key)).toEqual(['search', 'delete_item', 'send_mail']);
    expect(stats.tools[0]).toMatchObject({ key: 'search', calls: 40, allowed: true });
  });

  it('marks scopes required only by tools that were called', () => {
    let stats = build();

    expect(stats.scopes.find(scope => scope.scope == 'read:all')?.requiredByUsedTool).toBe(
      true
    );
    expect(stats.scopes.find(scope => scope.scope == 'write:all')?.requiredByUsedTool).toBe(
      false
    );
  });

  it('keeps tools that were called but are not in the catalog', () => {
    let stats = build({ toolUsage: [{ key: 'ghost', calls: 3, errors: 0 }] });

    expect(stats.tools.find(tool => tool.key == 'ghost')).toMatchObject({
      calls: 3,
      allowed: false,
      tags: []
    });
  });
});

describe('usageDeterministicFindings', () => {
  it('flags unused mutating tools and unused scopes once there is usage', () => {
    let { findings } = usageDeterministicFindings(build());

    expect(findings.map(finding => finding.key).sort()).toEqual([
      'usage-unused-mutating-tools',
      'usage-unused-scopes'
    ]);
  });

  it('flags calls to tools the filters now block', () => {
    let { findings, facts } = usageDeterministicFindings(
      build({ toolUsage: [{ key: 'send_mail', calls: 5, errors: 0 }] })
    );

    expect(findings.map(finding => finding.key)).toContain('usage-calls-outside-filter');
    expect(facts.map(fact => fact.id)).toContain('usage-outside-filter');
  });

  it('reports nothing about unused tools when there is no usage', () => {
    let { findings } = usageDeterministicFindings(build({ toolUsage: [] }));

    expect(findings).toEqual([]);
  });
});

describe('countSevereProtoGuardMatches', () => {
  it('counts only high and critical filters', () => {
    let stats = build({
      protoguard: [
        { filter: 'a', issueType: 'secret', severity: 'critical', matches: 4, alerts: 2 },
        { filter: 'b', issueType: 'pii', severity: 'low', matches: 9, alerts: 3 }
      ]
    });

    expect(countSevereProtoGuardMatches(stats)).toBe(4);
    expect(stats.protoguard).toMatchObject({ matches: 13, alerts: 5 });
  });
});
