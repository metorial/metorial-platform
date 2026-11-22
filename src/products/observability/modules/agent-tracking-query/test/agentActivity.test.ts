import { notFoundError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  agentTrackingAgentActivityService,
  consumerAgentKey
} from '../src/services/agentTrackingAgentActivity';
import {
  agentTrackingEnabled,
  callsTo,
  privacy,
  remoteMember,
  resetMocks,
  rpc,
  scope
} from './_mocks';

let activityScope = scope as any;

let earlier = '2026-11-10T08:00:00.000Z';

let later = '2026-11-20T08:00:00.000Z';

describe('agentTrackingAgentActivityService', () => {
  beforeEach(() => {
    resetMocks();
    rpc.handlers['entity:list'] = ({ ids }) => ({
      items: [
        remoteMember(),
        remoteMember({ id: 'aten_ada_alt', ref: 'con_ada' }),
        remoteMember({ id: 'aten_unlinked', source: 'discovered', ref: null })
      ].filter(member => ids.includes(member.id)),
      pagination: {}
    });
  });

  it('returns the latest use per agent in one query', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [
        { agent: 'cursor', last_activity: later },
        { agent: 'claude-code', last_activity: earlier }
      ],
      meta: { truncated: false }
    });

    let activity = await agentTrackingAgentActivityService.getAgentActivity({
      ...activityScope,
      agentKeys: ['cursor', 'claude-code', 'cursor']
    });

    expect(activity).toEqual(
      new Map([
        ['cursor', new Date(later)],
        ['claude-code', new Date(earlier)]
      ])
    );

    let [call] = callsTo('query:run');
    expect(callsTo('query:run')).toHaveLength(1);
    expect(call!.input.scope).toEqual({ instanceIds: ['inst_1'] });
    expect(call!.input.query).toMatchObject({
      dataset: 'sessions',
      dimensions: [{ field: 'agent', missing: 'exclude' }],
      measures: ['last_activity']
    });
    expect(call!.input.query.where.and[1]).toEqual({
      field: 'agent',
      op: 'in',
      value: ['claude-code', 'cursor']
    });
  });

  it('maps members to consumers and keeps the latest use across merged members', async () => {
    rpc.handlers['query:run'] = () => ({
      rows: [
        { agent: 'cursor', user: 'aten_ada', last_activity: earlier },
        { agent: 'cursor', user: 'aten_ada_alt', last_activity: later },
        { agent: 'cursor', user: 'aten_unlinked', last_activity: later }
      ],
      meta: { truncated: false }
    });

    let activity = await agentTrackingAgentActivityService.getConsumerAgentActivity({
      ...activityScope,
      agentKeys: ['cursor']
    });

    expect(activity).toEqual(
      new Map([[consumerAgentKey('con_ada', 'cursor'), new Date(later)]])
    );
    expect(callsTo('query:run')[0]!.input.query.dimensions).toEqual([
      { field: 'agent', missing: 'exclude' },
      { field: 'user', missing: 'exclude' }
    ]);
  });

  it('answers null without querying when agent tracking is off', async () => {
    agentTrackingEnabled.mockImplementation(async () => false);

    let activity = await agentTrackingAgentActivityService.getAgentActivity({
      ...activityScope,
      agentKeys: ['cursor']
    });

    expect(activity).toBeNull();
    expect(callsTo('query:run')).toHaveLength(0);
  });

  it('answers null per consumer while the organization hides individuals', async () => {
    privacy.hideIndividuals = true;

    let activity = await agentTrackingAgentActivityService.getConsumerAgentActivity({
      ...activityScope,
      agentKeys: ['cursor']
    });

    expect(activity).toBeNull();
    expect(callsTo('query:run')).toHaveLength(0);
  });

  it('answers null when agent tracking fails', async () => {
    rpc.handlers['query:run'] = () => {
      throw new ServiceError(notFoundError('organization'));
    };

    let activity = await agentTrackingAgentActivityService.getAgentActivity({
      ...activityScope,
      agentKeys: ['cursor']
    });

    expect(activity).toBeNull();
  });

  it('skips the query when there are no agents to look up', async () => {
    let activity = await agentTrackingAgentActivityService.getAgentActivity({
      ...activityScope,
      agentKeys: []
    });

    expect(activity).toEqual(new Map());
    expect(callsTo('query:run')).toHaveLength(0);
  });
});
