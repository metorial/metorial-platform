import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  dimensionCatalogOptions,
  haikuRaw
} from '@mtsrc/agent-tracking-module-usage/test/dimensionCatalog';
import { importKnowledge, sendClaudeApiRequest } from './knowledgeSupport';
import {
  type AtqQuery,
  createScope,
  createToken,
  isoRange,
  rowsByKey,
  rpcErrorCode,
  runQuery,
  sendDesktopContext,
  usagePollOptions
} from './support';

let sonnetRaw = 'claude-sonnet-4-5-20250929';

let rangeAroundNow = () =>
  isoRange(new Date(Date.now() - 24 * 60 * 60 * 1000), new Date(Date.now() + 60 * 60 * 1000));

let measures = ['cost.usd', 'cost.list', 'requests', 'users.active'];

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

  let usage = (query: AtqQuery) =>
    runQuery(scope.organization.id, {
      dataset: 'usage',
      range: rangeAroundNow(),
      measures,
      ...query
    });

  let byKey = async (dimensions: string[], where?: AtqQuery) => {
    let result = await usage({ dimensions, ...(where ? { where } : {}) });

    return rowsByKey(result.rows, dimensions, row => ({
      cost: row['cost.usd'],
      list: row['cost.list'],
      requests: row.requests,
      users: row['users.active']
    }));
  };

  await eventually(async () => {
    let total = await usage({ dimensions: [] });
    expect(total.rows[0]).toMatchObject({ requests: 4, 'users.active': 2 });
  }, usagePollOptions);

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
  }, usagePollOptions.timeoutMs + 30_000);

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

    expect(
      await byKey(['model'], { field: 'model.family', op: 'in', value: ['claude-haiku'] })
    ).toEqual({
      'claude-haiku-4-5': { cost: 1.5, list: 1.5, requests: 1, users: 1 }
    });

    expect(
      await byKey(['model.family'], { field: 'model.lab', op: 'notIn', value: ['anthropic'] })
    ).toEqual({
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

    expect(
      await byKey(['user'], { field: 'agent', op: 'in', value: ['claude-code'] })
    ).toEqual({
      [ada.token.userEntityId]: { cost: 4.5, list: 4.5, requests: 2, users: 1 },
      [grace.token.userEntityId]: { cost: 4.5, list: 4.5, requests: 2, users: 1 }
    });

    expect(
      await byKey(['agent'], { field: 'agent.maker', op: 'in', value: ['openai'] })
    ).toEqual({});
  });

  it('groups by the vendor recorded on slices', async () => {
    let { byKey } = await withKnowledge();

    expect(await byKey(['vendor'])).toMatchObject({ anthropic: { cost: 9, users: 2 } });
    expect(await byKey(['vendor.kind'])).toMatchObject({
      'first-party': { cost: 9, users: 2 }
    });
    expect(
      await byKey(['model'], { field: 'vendor.kind', op: 'in', value: ['cloud'] })
    ).toEqual({});
  });

  it('groups usage by the branch and tickets of Desktop context that arrived later', async () => {
    await importKnowledge(dimensionCatalogOptions());

    let { organization, secret } = await createToken();
    let sessionId = uniqueId('session');

    await sendClaudeApiRequest({
      secret,
      sessionId,
      model: sonnetRaw,
      inputTokens: 1_000_000,
      outputTokens: 0
    });

    let usage = (dimensions: string[]) =>
      runQuery(organization.id, {
        dataset: 'usage',
        range: rangeAroundNow(),
        measures: ['cost.usd', 'requests'],
        dimensions
      });

    await eventually(async () => {
      let result = await usage([]);
      expect(result.rows[0]).toMatchObject({ requests: 1 });
    }, usagePollOptions);

    expect(await sendDesktopContext(secret, sessionId)).toMatchObject({ accepted: 4 });

    await eventually(async () => {
      let byTicket = rowsByKey(
        (await usage(['ticket'])).rows,
        ['ticket'],
        row => row.requests
      );
      expect(byTicket).toEqual({ 'MT-365': 1, 'ENG-9': 1 });
    }, usagePollOptions);

    let byBranch = rowsByKey(
      (await usage(['branch'])).rows,
      ['branch'],
      row => row['cost.usd']
    );
    expect(byBranch).toEqual({ 'ivan/mt-365-title': 3 });
  });

  it('rejects unknown dimensions', async () => {
    let { organization } = await createScope();

    let query = (dimensions: string[], where?: AtqQuery) =>
      rpcErrorCode(
        runQuery(organization.id, {
          dataset: 'usage',
          range: rangeAroundNow(),
          measures: ['requests'],
          dimensions,
          ...(where ? { where } : {})
        })
      );

    expect(await query(['model.vendor'])).toBe('invalid_query');
    expect(await query([], { field: 'agent.name', op: 'in', value: ['x'] })).toBe(
      'invalid_query'
    );
    expect(await query(['agent', 'agentId', 'model.isLatest', 'vendor.kind'])).toBeUndefined();
  });
});
