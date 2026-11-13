import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { beforeAll, describe, expect, it } from 'vitest';
import { dimensionCatalogOptions, haikuRaw } from '../src/facts/tests/dimensionCatalog';
import { importKnowledge, sendClaudeApiRequest } from './knowledgeSupport';
import { createScope, createToken, groundstation, rpcErrorCode } from './support';

let sonnetRaw = 'claude-sonnet-4-5-20250929';

type UsageInput = Parameters<ReturnType<typeof groundstation>['usage']['query']>[0];

let settleTimeoutMs = 120_000;

let rangeAroundNow = () => ({
  from: new Date(Date.now() - 24 * 60 * 60 * 1000),
  to: new Date(Date.now() + 60 * 60 * 1000)
});

let seedUsage = async () => {
  await importKnowledge(dimensionCatalogOptions());

  let scope = await createScope();
  let ada = await createToken({ agentRef: uniqueId('agent') }, scope);
  let grace = await createToken({}, scope);

  let requests = [
    { token: ada, model: sonnetRaw, inputTokens: 1_000_000, outputTokens: 100_000 },
    { token: grace, model: sonnetRaw, inputTokens: 1_000_000, outputTokens: 0 },
    { token: grace, model: haikuRaw, inputTokens: 1_000_000, outputTokens: 100_000 },
    { token: ada, model: 'anthropic/claude-future-9', inputTokens: 10, outputTokens: 1 }
  ];

  for (let request of requests) {
    await sendClaudeApiRequest({
      secret: request.token.secret,
      sessionId: uniqueId('session'),
      model: request.model,
      inputTokens: request.inputTokens,
      outputTokens: request.outputTokens
    });
  }

  let usage = (input: Partial<Omit<UsageInput, 'organizationId'>>) =>
    groundstation().usage.query({
      organizationId: scope.organization.id,
      range: rangeAroundNow(),
      metrics: ['cost.usd', 'cost.list', 'requests', 'users.active'],
      ...input
    });

  let byKey = async (groupBy: string[], filters: UsageInput['filters'] = {}) => {
    let result = await usage({ groupBy, filters });

    return Object.fromEntries(
      result.rows.map(row => [
        groupBy.map(field => row.keys[field] ?? 'null').join('|'),
        {
          cost: row.metrics['cost.usd'],
          list: row.metrics['cost.list'],
          requests: row.metrics.requests,
          users: row.metrics['users.active']
        }
      ])
    );
  };

  await eventually(
    async () => {
      let total = await usage({ groupBy: [] });
      expect(total.rows[0]?.metrics).toMatchObject({ requests: 4, 'users.active': 2 });
    },
    { timeoutMs: settleTimeoutMs }
  );

  return { ...scope, ada, grace, usage, byKey };
};

describe('usage dimensions', () => {
  let seeded: Awaited<ReturnType<typeof seedUsage>>;

  let withKnowledge = async () => {
    await importKnowledge(dimensionCatalogOptions());
    return seeded;
  };

  beforeAll(async () => {
    seeded = await seedUsage();
  }, settleTimeoutMs + 30_000);

  it('groups by model family and lab, and filters by family', async () => {
    let { byKey } = await withKnowledge();

    expect(await byKey(['model.family'])).toEqual({
      'claude-sonnet': { cost: 7.5, list: 7.5, requests: 2, users: 2 },
      'claude-haiku': { cost: 1.5, list: 1.5, requests: 1, users: 1 },
      null: { cost: 0, list: 0, requests: 1, users: 2 }
    });

    expect(await byKey(['model.lab'])).toEqual({
      anthropic: { cost: 9, list: 9, requests: 4, users: 2 },
      null: { cost: 0, list: 0, requests: 0, users: 2 }
    });

    expect(await byKey(['model'], { 'model.family': { in: ['claude-haiku'] } })).toEqual({
      'claude-haiku-4-5': { cost: 1.5, list: 1.5, requests: 1, users: 1 }
    });

    expect(await byKey(['model.family'], { 'model.lab': { notIn: ['anthropic'] } })).toEqual({
      null: { cost: 0, list: 0, requests: 0, users: 2 }
    });
  });

  it('groups by the catalog agent, its maker and the agent entity', async () => {
    let { byKey, ada, grace } = await withKnowledge();

    expect(await byKey(['agent'])).toEqual({
      'claude-code': { cost: 9, list: 9, requests: 4, users: 2 }
    });

    let byAgentEntity = await byKey(['agent.maker', 'agentId']);
    let perUser = { cost: 4.5, list: 4.5, requests: 2, users: 1 };
    expect(byAgentEntity[`anthropic|${ada.token.agentEntityId}`]).toEqual(perUser);
    expect(Object.values(byAgentEntity)).toEqual([perUser, perUser]);

    expect(await byKey(['user'], { agent: { in: ['claude-code'] } })).toEqual({
      [ada.token.userEntityId]: { cost: 4.5, list: 4.5, requests: 2, users: 1 },
      [grace.token.userEntityId]: { cost: 4.5, list: 4.5, requests: 2, users: 1 }
    });

    expect(await byKey(['agent'], { 'agent.maker': { in: ['openai'] } })).toEqual({});
  });

  it('groups by the vendor recorded on slices', async () => {
    let { byKey } = await withKnowledge();

    expect(await byKey(['vendor'])).toMatchObject({ anthropic: { cost: 9, users: 2 } });
    expect(await byKey(['vendor.kind'])).toMatchObject({
      'first-party': { cost: 9, users: 2 }
    });
    expect(await byKey(['model'], { 'vendor.kind': { in: ['cloud'] } })).toEqual({});
  });

  it('rejects unknown dimensions', async () => {
    let { organization } = await createScope();

    let query = (groupBy: string[], filters: UsageInput['filters'] = {}) =>
      rpcErrorCode(
        groundstation().usage.query({
          organizationId: organization.id,
          range: rangeAroundNow(),
          metrics: ['requests'],
          groupBy,
          filters
        })
      );

    expect(await query(['model.vendor'])).toBe('bad_request');
    expect(await query([], { 'agent.name': { in: ['x'] } })).toBe('bad_request');
    expect(await query(['agent', 'agentId', 'model.isLatest', 'vendor.kind'])).toBeUndefined();
  });
});
