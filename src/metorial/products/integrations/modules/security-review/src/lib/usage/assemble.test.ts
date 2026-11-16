import type { SecurityReportFinding, SecurityUsageStats } from '@metorial-subspace/db';
import { describe, expect, it } from 'vitest';
import { assembleUsageReport, computeUsageScores, hasMutatingUsage } from './assemble';

let stats = (overrides: Partial<SecurityUsageStats> = {}): SecurityUsageStats => ({
  windowDays: 30,
  calls: 600,
  errors: 4,
  authConfigs: 2,
  configs: 2,
  tools: [
    { key: 'search', calls: 600, errors: 4, allowed: true, tags: ['read'] },
    { key: 'delete_item', calls: 0, errors: 0, allowed: true, tags: ['write', 'destructive'] }
  ],
  scopes: [
    { scope: 'read:all', authConfigs: 2, requiredByUsedTool: true },
    { scope: 'write:all', authConfigs: 2, requiredByUsedTool: false }
  ],
  protoguard: { matches: 0, alerts: 0, filters: [] },
  ...overrides
});

let finding = (key: string, severity: SecurityReportFinding['severity']) =>
  ({
    key,
    kind: 'security',
    category: 'excessive_scope',
    severity,
    title: key,
    body: 'Body.',
    tools: [],
    evidence: []
  }) as SecurityReportFinding;

describe('computeUsageScores', () => {
  it('derives exposure from the tools that were actually called', () => {
    let scores = computeUsageScores({ stats: stats(), findings: [], budgetExhausted: false });

    expect(scores.exposure).toBe('low');
    expect(scores.counts).toMatchObject({
      toolsAllowed: 2,
      toolsUsed: 1,
      toolsNeverUsed: 1,
      scopesGranted: 2,
      scopesUnused: 1
    });
  });

  it('reports unknown exposure and low confidence without any calls', () => {
    let scores = computeUsageScores({
      stats: stats({ calls: 0, tools: [] }),
      findings: [],
      budgetExhausted: false
    });

    expect(scores.exposure).toBe('unknown');
    expect(scores.confidence).toBe('low');
  });

  it('scales confidence with the number of calls and drops it when the budget ran out', () => {
    let confidence = (calls: number, budgetExhausted = false) =>
      computeUsageScores({ stats: stats({ calls }), findings: [], budgetExhausted })
        .confidence;

    expect(confidence(500)).toBe('high');
    expect(confidence(60)).toBe('medium');
    expect(confidence(10)).toBe('low');
    expect(confidence(900, true)).toBe('low');
  });

  it('counts only security findings by severity', () => {
    let scores = computeUsageScores({
      stats: stats(),
      findings: [
        finding('a', 'high'),
        finding('b', 'high'),
        { ...finding('c', 'info'), kind: 'positive' }
      ],
      budgetExhausted: false
    });

    expect(scores.counts.findings).toMatchObject({ high: 2, info: 0 });
  });
});

describe('hasMutatingUsage', () => {
  it('is true only when a called tool changes data', () => {
    expect(hasMutatingUsage(stats())).toBe(false);
    expect(
      hasMutatingUsage(
        stats({
          tools: [{ key: 'delete_item', calls: 3, errors: 0, allowed: true, tags: ['write'] }]
        })
      )
    ).toBe(true);
  });
});

describe('assembleUsageReport', () => {
  it('keeps detector findings and drops agent findings that repeat them', () => {
    let { report, findings } = assembleUsageReport({
      stats: stats(),
      recorded: [finding('usage-unused-scopes', 'low')],
      draft: {
        findings: [finding('usage-unused-scopes', 'high'), finding('agent-finding', 'medium')]
      },
      gaps: [],
      budgetExhausted: false
    });

    expect(report.findings?.map(item => item.key)).toEqual([
      'agent-finding',
      'usage-unused-scopes'
    ]);
    expect(findings.map(entry => entry.origin)).toEqual(['agent', 'detector']);
  });

  it('records why the analysis is incomplete', () => {
    let { report } = assembleUsageReport({
      stats: stats(),
      recorded: [],
      draft: null,
      gaps: ['Tool filters could not be read.'],
      budgetExhausted: true
    });

    expect(report.method?.limitations).toEqual([
      'The AI analysis of this usage did not complete.',
      'The analysis ran out of budget before it finished.',
      'Tool filters could not be read.'
    ]);
  });
});
