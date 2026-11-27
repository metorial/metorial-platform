import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-agent-tracking-query', () => ({
  filterFieldKeys: [
    'member',
    'model',
    'client',
    'seat',
    'repository',
    'branch',
    'ticket',
    'provider'
  ],
  requestRecordDays: 90
}));

import { v1AgentTrackingFilterValuesPresenter } from './agentTrackingFilterValues';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let range = {
  preset: 'last_30_days' as const,
  from: new Date('2026-10-24T00:00:00Z'),
  to: new Date('2026-11-22T12:00:00Z'),
  timeZone: 'UTC'
};

let none = { member: null, model: null, client: null, repository: null };

describe('agent tracking filter values presenter', () => {
  it('presents provider values with their names, without a name when Metorial cannot show one', async () => {
    let presented = await v1AgentTrackingFilterValuesPresenter
      .present(
        {
          filterValues: {
            field: 'provider',
            range,
            truncated: false,
            items: [
              {
                ...none,
                value: 'pro_linear',
                kind: 'provider',
                provider: { id: 'pro_linear', name: 'Linear' },
                requests: 4
              },
              {
                ...none,
                value: 'pro_gone',
                kind: 'provider',
                provider: { id: 'pro_gone', name: null },
                requests: 1
              }
            ]
          }
        },
        context
      )
      .run();

    expect(presented).toMatchObject({
      object: 'agent_tracking.filter_values',
      field: 'provider',
      items: [
        {
          ...none,
          value: 'pro_linear',
          kind: 'provider',
          provider: { id: 'pro_linear', name: 'Linear' },
          requests: 4
        },
        { value: 'pro_gone', provider: { id: 'pro_gone', name: null } }
      ]
    });
  });

  it('leaves the provider out of other fields', async () => {
    let presented = await v1AgentTrackingFilterValuesPresenter
      .present(
        {
          filterValues: {
            field: 'branch',
            range,
            truncated: false,
            items: [{ ...none, value: 'main', kind: 'branch', provider: null, requests: 2 }]
          }
        },
        context
      )
      .run();

    expect(presented.items[0]).toMatchObject({ value: 'main', provider: null });
  });
});
