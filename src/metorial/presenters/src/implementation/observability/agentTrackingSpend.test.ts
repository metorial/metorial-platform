import type { AgentTrackingSpendBreakdownItem } from '@metorial/module-agent-tracking-query';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-agent-tracking-query', () => ({
  breakdownGroupKeys: ['member', 'model', 'repository', 'branch', 'ticket'],
  growthRateBounds: { input: { min: -0.5, max: 0.5 }, observed: { min: -0.25, max: 0.25 } },
  maxDistinctCount: 10_000,
  reportBreakdownLimits: { model: 50, client: 50, member: 1000 }
}));

import { v1AgentTrackingSpendBreakdownPresenter } from './agentTrackingSpend';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let figures = {
  cost: {
    totalMicros: 5000,
    billedMicros: null,
    estimatedMicros: 5000,
    isEstimate: true,
    reportedByClientMicros: 5000,
    listPriceMicros: 5000,
    requestsWithoutCost: 0,
    requestsWithoutListPrice: 0
  },
  requests: 4,
  tokens: { input: 1, cacheRead: 1, cacheWrite: 1, output: 1, reasoning: 0, total: 4 }
};

let range = {
  preset: 'last_7_days' as const,
  from: new Date('2026-11-16T00:00:00Z'),
  to: new Date('2026-11-23T00:00:00Z'),
  timeZone: 'UTC'
};

let item = (
  overrides: Pick<AgentTrackingSpendBreakdownItem, 'kind' | 'key'> &
    Partial<AgentTrackingSpendBreakdownItem>
): AgentTrackingSpendBreakdownItem => ({
  member: null,
  model: null,
  client: null,
  repository: null,
  ticket: null,
  unknownModelNames: [],
  share: 0.5,
  ...figures,
  ...overrides
});

describe('agent tracking spend breakdown presenter', () => {
  it('presents a breakdown by repository with the repository of each item', async () => {
    let repository = {
      id: 'aten_repo',
      provider: 'github.com',
      host: 'github.com',
      owner: 'acme',
      name: 'api',
      url: 'https://github.com/acme/api'
    };

    let presented = await v1AgentTrackingSpendBreakdownPresenter
      .present(
        {
          breakdown: {
            range,
            groupBy: 'repository',
            total: figures,
            items: [
              item({ kind: 'repository', key: 'aten_repo', repository }),
              item({ kind: 'unknown', key: 'unknown' })
            ]
          }
        },
        context
      )
      .run();

    expect(presented.group_by).toBe('repository');
    expect(presented.items.map(entry => [entry.kind, entry.key, entry.repository])).toEqual([
      ['repository', 'aten_repo', repository],
      ['unknown', 'unknown', null]
    ]);
    expect(presented.items[0]).not.toHaveProperty('client');
    expect(presented.items.map(entry => entry.ticket)).toEqual([null, null]);
  });

  it('presents the ticket of a ticket row with its link', async () => {
    let presented = await v1AgentTrackingSpendBreakdownPresenter
      .present(
        {
          breakdown: {
            range,
            groupBy: 'ticket',
            total: figures,
            items: [
              item({
                kind: 'ticket',
                key: 'ENG-12',
                ticket: { key: 'ENG-12', url: 'https://linear.app/acme/issue/ENG-12' }
              })
            ]
          }
        },
        context
      )
      .run();

    expect(presented.items[0]).toMatchObject({
      kind: 'ticket',
      key: 'ENG-12',
      ticket: { key: 'ENG-12', url: 'https://linear.app/acme/issue/ENG-12' },
      repository: null
    });
  });
});
