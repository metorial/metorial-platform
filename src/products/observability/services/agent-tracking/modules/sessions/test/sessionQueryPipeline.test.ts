import { describe, expect, it } from 'vitest';
import {
  buildSessionPipeline,
  buildTopSessionsQuery,
  finalizeSessionGroups,
  percentile,
  validateSessionQuery,
  type SessionQuery
} from '../src/lib/sessionQueryPipeline';

let query = (overrides: Partial<SessionQuery> = {}): SessionQuery => ({
  organizationId: 'org_1',
  range: { from: new Date('2026-11-01T00:00:00Z'), to: new Date('2026-11-08T00:00:00Z') },
  filters: {},
  groupBy: [],
  stats: ['count'],
  ...overrides
});

describe('percentile', () => {
  it('interpolates between ranks', () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([7], 0.9)).toBe(7);
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
  });
});

describe('validateSessionQuery', () => {
  it('rejects unknown fields and empty stats', () => {
    expect(() => validateSessionQuery(query({ groupBy: ['team', 'state'] }))).not.toThrow();
    expect(() => validateSessionQuery(query({ groupBy: ['model'] }))).toThrow();
    expect(() => validateSessionQuery(query({ filters: { nope: { in: ['x'] } } }))).toThrow();
    expect(() => validateSessionQuery(query({ stats: [] }))).toThrow();
  });
});

describe('buildSessionPipeline', () => {
  it('filters kinds by attribution dim ids and groups kinds by attribution entries', () => {
    let pipeline = buildSessionPipeline(
      query({
        groupBy: ['client.family', 'team'],
        filters: { project: { in: ['prj_a'] } },
        stats: ['sum', 'p50'],
        metrics: ['cost.usd']
      })
    );

    expect(pipeline[0]).toEqual({
      $match: {
        organizationId: 'org_1',
        startedAt: { $gte: query().range.from, $lt: query().range.to },
        $and: [{ 'attribution.dimIds': { $in: ['prj_a'] } }]
      }
    });
    expect(pipeline[1]).toEqual({
      $addFields: {
        _g1: {
          $filter: {
            input: { $ifNull: ['$attribution.entries', []] },
            cond: { $eq: ['$$this.kind', 'team'] }
          }
        }
      }
    });

    let group = (pipeline[3] as { $group: Record<string, any> }).$group;
    expect(group._id).toEqual({ k0: '$client.family', k1: '$_g1.entityId' });
    expect(group.costUsd_sum).toBeDefined();
    expect(group.costUsd_values).toEqual({ $push: { $toDouble: '$summary.costUsd' } });
    expect(group.costUsd_avg).toBeUndefined();
  });

  it('sorts top sessions by the metric and caps the limit', () => {
    expect(buildTopSessionsQuery(query())).toBeNull();

    let top = buildTopSessionsQuery(query({ top: { by: 'cost.usd', limit: 500 } }))!;
    expect(top.sort).toEqual({ 'summary.costUsd': -1, _id: 1 });
    expect(top.limit).toBe(100);
    expect(top.filter).toMatchObject({ 'summary.costUsd': { $ne: null } });
  });
});

describe('finalizeSessionGroups', () => {
  it('computes stats per group and orders by count', () => {
    let groups = finalizeSessionGroups(
      query({
        groupBy: ['team'],
        stats: ['count', 'sum', 'avg', 'p50', 'p90'],
        metrics: ['requests']
      }),
      [
        {
          _id: { k0: 'team_a' },
          count: 2,
          requests_sum: 30,
          requests_avg: 15,
          requests_values: [10, 20]
        },
        {
          _id: {},
          count: 3,
          requests_sum: 6,
          requests_avg: 2,
          requests_values: [1, 2, 3, null]
        }
      ]
    );

    expect(groups).toEqual([
      {
        keys: { team: null },
        count: 3,
        stats: { requests: { sum: 6, avg: 2, p50: 2, p90: 2.8 } }
      },
      {
        keys: { team: 'team_a' },
        count: 2,
        stats: { requests: { sum: 30, avg: 15, p50: 15, p90: 19 } }
      }
    ]);
  });
});
