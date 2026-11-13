import { ServiceError } from '@lowerdeck/error';
import { describe, expect, it } from 'vitest';
import {
  bucketExpression,
  buildUsagePipelines,
  filterMatch,
  finalizeUsageRows,
  usageFieldPaths,
  validateUsageQuery,
  type UsageQuery
} from '../usageQuery';

let query = (overrides: Partial<UsageQuery> = {}): UsageQuery => ({
  organizationId: 'org_1',
  range: { from: new Date('2026-11-01T00:00:00Z'), to: new Date('2026-11-08T00:00:00Z') },
  metrics: ['cost.usd'],
  groupBy: [],
  filters: {},
  allocation: 'full',
  ...overrides
});

let rejects = (value: UsageQuery) => {
  try {
    validateUsageQuery(value);
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError);
    return true;
  }

  return false;
};

let stringify = (value: unknown) => JSON.stringify(value);

describe('validateUsageQuery', () => {
  it('accepts built-in fields and kind keys', () => {
    expect(
      rejects(
        query({
          groupBy: ['team', 'model', 'custom:product'],
          filters: { user: { in: ['ada'] }, cost_center: { notIn: ['cc_1'] } },
          interval: 'day',
          timeZone: 'Asia/Kolkata',
          orderBy: { by: 'cost.usd', direction: 'desc' }
        })
      )
    ).toBe(false);
  });

  it('rejects bad ranges, zones, fields and orderings', () => {
    let from = new Date('2026-01-01T00:00:00Z');

    expect(rejects(query({ range: { from, to: from } }))).toBe(true);
    expect(rejects(query({ range: { from, to: new Date('2027-03-01T00:00:00Z') } }))).toBe(
      true
    );
    expect(
      rejects(
        query({ interval: 'hour', range: { from, to: new Date('2026-03-01T00:00:00Z') } })
      )
    ).toBe(true);
    expect(rejects(query({ timeZone: 'Mars/Olympus' }))).toBe(true);
    expect(rejects(query({ metrics: [] }))).toBe(true);
    expect(rejects(query({ groupBy: ['nope'] }))).toBe(true);
    expect(rejects(query({ groupBy: ['team', 'team'] }))).toBe(true);
    expect(rejects(query({ groupBy: ['team', 'user', 'model', 'device', 'agent'] }))).toBe(
      true
    );
    expect(rejects(query({ filters: { 'model.family': { in: ['x'] } } }))).toBe(true);
    expect(rejects(query({ orderBy: { by: 'tokens', direction: 'asc' } }))).toBe(true);
    expect(
      rejects(
        query({
          metrics: ['cost.reported'],
          orderBy: { by: 'cost.reported', direction: 'asc' }
        })
      )
    ).toBe(true);
  });
});

describe('filterMatch', () => {
  it('filters built-in fields by path and kinds by dim ids', () => {
    expect(
      filterMatch(
        {
          user: { in: ['ada'], notIn: ['grace'] },
          team: { in: ['team_a'] },
          project: { notIn: ['prj_x'] }
        },
        usageFieldPaths,
        'dimIds'
      )
    ).toEqual({
      userId: { $in: ['ada'], $nin: ['grace'] },
      $and: [{ dimIds: { $in: ['team_a'] } }, { dimIds: { $nin: ['prj_x'] } }]
    });
  });
});

describe('bucketExpression', () => {
  it('truncates in the viewer zone and keeps daily aggregates on their own day', () => {
    let expression = bucketExpression('week', 'Asia/Kathmandu') as { $cond: unknown[] };
    let [condition, daily, fifteen] = expression.$cond;

    expect(condition).toEqual({ $eq: ['$bucketMinutes', 1440] });
    expect(fifteen).toEqual({
      $dateTrunc: {
        date: '$bucket',
        unit: 'week',
        timezone: 'Asia/Kathmandu',
        startOfWeek: 'monday'
      }
    });
    expect(stringify(daily)).toContain('"$dateFromParts"');
    expect(stringify(daily)).toContain('"timezone":"Asia/Kathmandu"');
  });
});

describe('buildUsagePipelines', () => {
  it('scopes the match and groups by built-in paths', () => {
    let { main, reported } = buildUsagePipelines(
      query({
        instanceIds: ['ins_1'],
        groupBy: ['model', 'client.family'],
        metrics: ['tokens', 'users.active'],
        interval: 'day'
      })
    );

    expect(main[0]).toEqual({
      $match: {
        organizationId: 'org_1',
        bucket: { $gte: query().range.from, $lt: query().range.to },
        instanceId: { $in: ['ins_1'] }
      }
    });

    let group = (main[1] as { $group: Record<string, any> }).$group;
    expect(group._id.k0).toBe('$modelId');
    expect(group._id.k1).toBe('$client.family');
    expect(group._id.t).toBeDefined();
    expect(group.tokens_inputUncached).toEqual({
      $sum: { $ifNull: ['$tokens.inputUncached', 0] }
    });
    expect(group.users).toEqual({ $addToSet: '$userId' });
    expect(reported).toBeNull();
  });

  it('unwinds dims for kind groups and leaves full allocation unweighted', () => {
    let { main } = buildUsagePipelines(query({ groupBy: ['team'] }));

    expect(main[1]).toEqual({
      $addFields: {
        _g0: {
          $filter: {
            input: { $ifNull: ['$dims', []] },
            cond: { $eq: ['$$this.kind', 'team'] }
          }
        }
      }
    });
    expect(main[2]).toEqual({ $unwind: { path: '$_g0', preserveNullAndEmptyArrays: true } });

    let group = (main[3] as { $group: Record<string, any> }).$group;
    expect(group._id).toEqual({ k0: '$_g0.id' });
    expect(group.costUsd).toEqual({ $sum: { $toDouble: { $ifNull: ['$costUsd', 0] } } });
  });

  it('multiplies by the dim weight of every kind group and kind filter for split', () => {
    let { main } = buildUsagePipelines(
      query({
        groupBy: ['team', 'cost_center'],
        filters: { project: { in: ['prj_a'] } },
        allocation: 'split'
      })
    );

    let group = (main.at(-2) as { $group: Record<string, any> }).$group;
    let factors = group.costUsd.$sum.$multiply[1].$multiply;

    expect(factors).toHaveLength(3);
    expect(factors[0]).toEqual({ $ifNull: ['$_g0.w', 1] });
    expect(factors[1]).toEqual({ $ifNull: ['$_g1.w', 1] });
    expect(stringify(factors[2])).toContain('prj_a');
  });

  it('builds a separate reported-cost pipeline', () => {
    let { reported } = buildUsagePipelines(query({ metrics: ['cost.reported'] }));

    expect(reported).toContainEqual({ $unwind: '$costReported' });
  });
});

describe('finalizeUsageRows', () => {
  it('merges model families, counts distinct users and orders by the first metric', () => {
    let result = finalizeUsageRows({
      query: query({
        groupBy: ['model.family'],
        metrics: ['cost.usd', 'users.active', 'tokens']
      }),
      rows: [
        {
          _id: { k0: 'claude-sonnet-4-5' },
          costUsd: 1,
          users: ['ada', null],
          tokens_inputUncached: 10,
          tokens_output: 5
        },
        { _id: { k0: 'claude-opus-4-1' }, costUsd: 2, users: ['ada', 'grace'] },
        { _id: { k0: 'gpt-5' }, costUsd: 4, users: ['grace'] }
      ],
      resolveModelFamily: modelId => (modelId?.startsWith('claude') ? 'claude' : modelId)
    });

    expect(result.truncated).toBe(false);
    expect(result.rows).toEqual([
      {
        keys: { 'model.family': 'gpt-5' },
        metrics: {
          'cost.usd': 4,
          'users.active': 1,
          tokens: {
            inputUncached: 0,
            cacheRead: 0,
            cacheWrite: 0,
            output: 0,
            reasoning: 0,
            total: 0
          }
        }
      },
      {
        keys: { 'model.family': 'claude' },
        metrics: {
          'cost.usd': 3,
          'users.active': 2,
          tokens: {
            inputUncached: 10,
            cacheRead: 0,
            cacheWrite: 0,
            output: 5,
            reasoning: 0,
            total: 15
          }
        }
      }
    ]);
  });

  it('orders time series ascending, attaches reported costs and truncates at the limit', () => {
    let day = (date: string) => new Date(`2026-11-0${date}T00:00:00Z`);

    let result = finalizeUsageRows({
      query: query({ interval: 'day', metrics: ['requests', 'cost.reported'], limit: 2 }),
      rows: [
        { _id: { t: day('3') }, requests: 3 },
        { _id: { t: day('1') }, requests: 1 },
        { _id: { t: day('2') }, requests: 2 }
      ],
      reported: [
        { _id: { t: day('1'), unit: 'usd', basis: 'billed' }, amount: 0.5 },
        { _id: { t: day('1'), unit: 'credits', basis: 'billed' }, amount: 7 }
      ],
      resolveModelFamily: modelId => modelId
    });

    expect(result.truncated).toBe(true);
    expect(result.rows.map(row => row.time)).toEqual([day('1'), day('2')]);
    expect(result.rows[0]!.metrics['cost.reported']).toEqual([
      { unit: 'credits', basis: 'billed', amount: 7 },
      { unit: 'usd', basis: 'billed', amount: 0.5 }
    ]);
    expect(result.rows[1]!.metrics['cost.reported']).toEqual([]);
  });
});
