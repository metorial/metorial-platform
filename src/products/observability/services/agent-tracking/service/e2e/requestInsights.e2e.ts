import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { sendClaudeApiRequest } from './knowledgeSupport';
import {
  agentTracking,
  createScope,
  createToken,
  isoRange,
  rowsByKey,
  rpcErrorCode,
  runQuery
} from './support';

let hourMs = 60 * 60 * 1000;
let settleTimeoutMs = 120_000;
let model = 'claude-opus-4-1-20250805';

let premium = {
  'anthropic.provider': 'firstParty',
  'anthropic.plan': 'max',
  'anthropic.seat_type': 'premium'
};

let range = () => isoRange(new Date(Date.now() - hourMs), new Date(Date.now() + hourMs));

let effortMix = [
  'requests',
  {
    fn: 'count',
    as: 'requests.max',
    where: { field: 'reasoning.effort', op: 'eq', value: 'max' }
  },
  {
    fn: 'count',
    as: 'requests.high',
    where: { field: 'reasoning.effort', op: 'eq', value: 'high' }
  },
  { fn: 'count', as: 'requests.fast', where: { field: 'speed', op: 'eq', value: 'fast' } }
];

describe('request effort, speed and seat insights', { timeout: 300_000 }, () => {
  it('answers effort, speed and seat questions per user from Claude Code requests', async () => {
    let scope = await createScope();
    let ada = await createToken({}, scope);
    let grace = await createToken({}, scope);
    let organizationId = scope.organization.id;

    let send = (secret: string, attributes: Record<string, string | number>) =>
      sendClaudeApiRequest({
        secret,
        sessionId: uniqueId('session'),
        model,
        inputTokens: 1000,
        outputTokens: 100,
        attributes
      });

    await send(ada.secret, { ...premium, effort: 'max', speed: 'fast', duration_ms: 4000 });
    await send(ada.secret, {
      ...premium,
      effort: 'high',
      speed: 'standard',
      duration_ms: 2000
    });
    await send(ada.secret, { ...premium, effort: 'max', speed: 'fast', duration_ms: 3000 });
    await send(grace.secret, {
      'anthropic.provider': 'firstParty',
      effort: 'high',
      duration_ms: 1000
    });
    await send(grace.secret, {
      'anthropic.provider': 'firstParty',
      'anthropic.plan': 'team',
      'anthropic.seat_type': 'standard',
      duration_ms: 1500
    });

    let perUser = async () => {
      let result = await runQuery(organizationId, {
        dataset: 'requests',
        range: range(),
        dimensions: ['user'],
        measures: effortMix
      });

      return Object.fromEntries(result.rows.map(row => [row.user, row]));
    };

    await eventually(
      async () => {
        let rows = await perUser();

        expect(rows[ada.token.userEntityId!]).toMatchObject({
          requests: 3,
          'requests.max': 2,
          'requests.high': 1,
          'requests.fast': 2
        });
        expect(rows[grace.token.userEntityId!]).toMatchObject({
          requests: 2,
          'requests.max': 0,
          'requests.high': 1,
          'requests.fast': 0
        });
      },
      { timeoutMs: settleTimeoutMs }
    );

    let seats = await runQuery(organizationId, {
      dataset: 'requests',
      range: range(),
      dimensions: ['user', 'billing.seat'],
      measures: ['requests']
    });
    expect(rowsByKey(seats.rows, ['user', 'billing.seat'], row => row.requests)).toEqual({
      [`${ada.token.userEntityId}|premium`]: 3,
      [`${grace.token.userEntityId}|standard`]: 1,
      [`${grace.token.userEntityId}|null`]: 1
    });

    let billing = await runQuery(organizationId, {
      dataset: 'requests',
      range: range(),
      dimensions: ['billing.plan'],
      measures: ['requests', 'latency']
    });
    expect(
      rowsByKey(billing.rows, ['billing.plan'], row => ({
        requests: row.requests,
        latency: row.latency
      }))
    ).toEqual({
      max: { requests: 3, latency: 3000 },
      team: { requests: 1, latency: 1500 },
      null: { requests: 1, latency: 1000 }
    });

    let values = await agentTracking().query.values({
      organizationId,
      dataset: 'requests',
      field: 'billing.seat',
      range: range()
    });
    expect(JSON.stringify(values)).toContain('premium');
    expect(JSON.stringify(values)).toContain('standard');

    let catalog = await agentTracking().query.catalog({ organizationId, dataset: 'requests' });
    let fields = catalog.datasets[0]!.fields;
    expect(fields.find(field => field.name == 'billing.seat')).toMatchObject({
      dimension: true,
      filter: true,
      measure: false,
      sensitivity: 'normal'
    });
    let names = fields.map(field => field.name);
    expect(names).toEqual(
      expect.arrayContaining(['billing.plan', 'billing.seat', 'reasoning.effort', 'speed'])
    );
    expect(names).not.toContain('billing.mode');
  });

  it('keeps individuals hidden and merges small seat groups', async () => {
    let scope = await createScope();
    let ada = await createToken({}, scope);
    let grace = await createToken({}, scope);
    let organizationId = scope.organization.id;

    let send = (secret: string, attributes: Record<string, string | number>) =>
      sendClaudeApiRequest({
        secret,
        sessionId: uniqueId('session'),
        model,
        inputTokens: 1000,
        outputTokens: 100,
        attributes
      });

    await send(ada.secret, { ...premium, effort: 'max' });
    await send(grace.secret, {
      'anthropic.provider': 'firstParty',
      'anthropic.plan': 'team',
      'anthropic.seat_type': 'standard'
    });

    await eventually(
      async () => {
        let result = await runQuery(organizationId, {
          dataset: 'requests',
          range: range(),
          measures: ['requests']
        });
        expect(result.rows[0]).toMatchObject({ requests: 2 });
      },
      { timeoutMs: settleTimeoutMs }
    );

    await agentTracking().organization.upsert({
      ref: scope.organization.ref,
      settings: { privacy: { hideIndividuals: true, minGroupUsers: 2 } }
    });

    expect(
      await rpcErrorCode(
        runQuery(organizationId, {
          dataset: 'requests',
          range: range(),
          dimensions: ['user', 'billing.seat'],
          measures: ['requests']
        })
      )
    ).toBe('invalid_query');

    let seats = await runQuery(organizationId, {
      dataset: 'requests',
      range: range(),
      dimensions: ['billing.seat'],
      measures: ['requests']
    });
    expect(rowsByKey(seats.rows, ['billing.seat'], row => row.requests)).toEqual({
      $other: 2
    });
  });
});
