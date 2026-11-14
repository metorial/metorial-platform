import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { importKnowledge, sendClaudeApiRequest } from './knowledgeSupport';
import {
  agentTracking,
  type AtqQuery,
  createScope,
  createToken,
  isoRange,
  rowsByKey,
  runQuery
} from './support';

let hourMs = 60 * 60 * 1000;
let settleTimeoutMs = 120_000;
let sonnetModel = 'claude-sonnet-4-5-20250929';

let hoursAgo = (hours: number) => new Date(Date.now() - hours * hourMs);

let plan = {
  'anthropic.provider': 'firstParty',
  'anthropic.plan': 'max',
  'anthropic.seat_type': 'standard'
};

describe('billing mode', { timeout: 300_000 }, () => {
  it('splits usage by billing mode and follows declarations and limited overrides', async () => {
    await importKnowledge();

    let scope = await createScope();
    let ada = await createToken({}, scope);
    let grace = await createToken({}, scope);
    let organizationId = scope.organization.id;

    let planSession = uniqueId('session');
    let send = (d: {
      secret: string;
      sessionId: string;
      minutes: number;
      attributes?: Record<string, string | number>;
    }) =>
      sendClaudeApiRequest({
        secret: d.secret,
        sessionId: d.sessionId,
        model: sonnetModel,
        inputTokens: 1_000_000,
        outputTokens: 0,
        at: new Date(hoursAgo(2).getTime() + d.minutes * 60_000),
        attributes: d.attributes
      });

    await send({
      secret: ada.secret,
      sessionId: planSession,
      minutes: 0,
      attributes: { ...plan, query_source: 'repl_main_thread', cache_creation_1h_tokens: 10 }
    });
    await send({
      secret: ada.secret,
      sessionId: planSession,
      minutes: 1,
      attributes: { ...plan, query_source: 'repl_main_thread', cache_creation_5m_tokens: 10 }
    });
    await send({
      secret: ada.secret,
      sessionId: uniqueId('session'),
      minutes: 2,
      attributes: { 'anthropic.provider': 'firstParty' }
    });
    await send({ secret: grace.secret, sessionId: uniqueId('session'), minutes: 3 });

    let byKey = async (dimensions: string[], where?: AtqQuery) => {
      let result = await runQuery(organizationId, {
        dataset: 'usage',
        range: isoRange(hoursAgo(24), new Date(Date.now() + hourMs)),
        measures: ['requests', 'cost.usd', 'cost.list'],
        dimensions,
        ...(where ? { where } : {})
      });

      return rowsByKey(
        result.rows.filter(row => row.requests),
        dimensions,
        row => ({ requests: row.requests, cost: row['cost.usd'] })
      );
    };

    await eventually(
      async () => {
        expect(await byKey(['billing.mode', 'billing.source', 'billing.plan'])).toEqual({
          'included|reported|max': { requests: 1, cost: expect.any(Number) },
          'overage|inferred|max': { requests: 1, cost: expect.any(Number) },
          'api|reported|null': { requests: 1, cost: 3 },
          'unknown|null|null': { requests: 1, cost: 3 }
        });
      },
      { timeoutMs: settleTimeoutMs }
    );

    expect(
      await byKey(['billing.mode'], {
        field: 'billing.mode',
        op: 'in',
        value: ['included', 'overage']
      })
    ).toEqual({
      included: { requests: 1, cost: expect.any(Number) },
      overage: { requests: 1, cost: expect.any(Number) }
    });

    let sessions = await agentTracking().session.list({
      organizationId,
      instanceIds: [scope.instance.id]
    });
    let billingRows = await Promise.all(
      sessions.items.map(async item => {
        let session = await agentTracking().session.get({
          organizationId,
          sessionKey: item.sessionKey
        });

        return session.summary!.models.map(model => model.billing);
      })
    );
    expect(
      billingRows.sort((a, b) => b.length - a.length || a[0]!.mode.localeCompare(b[0]!.mode))
    ).toEqual([
      [
        { mode: 'included', source: 'reported', plan: 'max' },
        { mode: 'overage', source: 'inferred', plan: 'max' }
      ],
      [{ mode: 'api', source: 'reported', plan: null }],
      [{ mode: 'unknown', source: null, plan: null }]
    ]);

    await agentTracking().billing.declarations.create({
      organizationId,
      name: 'Team seats',
      userId: grace.token.userEntityId!,
      agentId: 'claude-code',
      mode: 'included',
      plan: 'team',
      validFrom: hoursAgo(24)
    });

    await eventually(
      async () => {
        expect(await byKey(['billing.mode', 'billing.source'])).toMatchObject({
          'included|declared': { requests: 1, cost: 3 },
          'api|reported': { requests: 1, cost: 3 }
        });
      },
      { timeoutMs: settleTimeoutMs }
    );

    await agentTracking().pricing.overrides.create({
      organizationId,
      name: 'Plan usage is prepaid',
      target: 'agent',
      targetId: 'claude-code',
      kind: 'included',
      billingModes: ['included'],
      validFrom: hoursAgo(24)
    });

    await eventually(
      async () => {
        let rows = await byKey(['billing.mode', 'billing.source']);

        expect(rows['included|declared']).toEqual({ requests: 1, cost: 0 });
        expect(rows['included|reported']?.cost).toBe(0);
        expect(rows['api|reported']).toEqual({ requests: 1, cost: 3 });
        expect(rows['overage|inferred']?.cost).toBeGreaterThan(0);
      },
      { timeoutMs: settleTimeoutMs }
    );
  });
});
