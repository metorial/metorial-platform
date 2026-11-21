import { eventually, expectServiceError, uniqueId } from '@metorial/e2e';
import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { gateway, openaiClient } from '../support/client';
import {
  chat,
  createConnection,
  createTenant,
  createToken,
  drain,
  failing,
  respondPerKey,
  useCatalog,
  useUpstream,
  type Tenant
} from '../support/fixtures';

describe('ai-gateway inference log api', () => {
  useCatalog();
  let upstream = useUpstream();

  let logsOf = async (tenant: Tenant, count: number, filter: Record<string, unknown> = {}) => {
    let items: Awaited<ReturnType<typeof gateway.inferenceLog.list>>['items'] = [];

    await eventually(async () => {
      let page = await gateway.inferenceLog.list({
        organizationId: tenant.organization.id,
        instanceId: tenant.instance.id,
        ...filter
      });
      items = page.items;
      expect(items).toHaveLength(count);
    });

    return items;
  };

  it('records a successful request', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant, { consumerRef: 'user_7' });
    upstream.respond({
      steps: [{ type: 'text', text: 'Hello' }],
      usage: { input: 30, output: 10 }
    });

    await chat(
      token.secret,
      catalogModels.haiku,
      {},
      { 'x-metorial-metadata': '{"team":"search"}' }
    );
    let [log] = await logsOf(tenant, 1);

    expect(log).toMatchObject({
      object: 'ai_gateway#inference_log',
      organizationId: tenant.organization.id,
      projectId: tenant.project.id,
      instanceId: tenant.instance.id,
      tokenId: token.id,
      consumerRef: 'user_7',
      dialect: 'openai_chat',
      requestedModel: catalogModels.haiku,
      model: { slug: catalogModels.haiku },
      metadata: { team: 'search' },
      status: 'succeeded',
      finishReason: 'stop',
      error: null,
      virtualModel: null,
      hasContent: false
    });
    expect(log!.usage).toMatchObject({ input: { total: 30 }, output: { total: 10 } });
    expect(log!.timing.totalMs).toBeGreaterThanOrEqual(0);
    expect(new Date(log!.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('hides which provider key served Metorial traffic', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);

    await chat(token.secret, catalogModels.haiku);
    let [log] = await logsOf(tenant, 1);

    expect(log!.route).toEqual({ provider: 'metorial', connectionOwner: 'platform' });
    expect(log!.attempts).toMatchObject([
      { provider: 'metorial', connectionOwner: 'platform', outcome: 'succeeded' }
    ]);
    expect(JSON.stringify(log)).not.toContain('connectionId');
    expect(JSON.stringify(log)).not.toContain('vendorModelId');
  });

  it('names the customer connection that served a request', async () => {
    let tenant = await createTenant();
    let connection = await createConnection(tenant);
    let token = await createToken(tenant);

    await chat(token.secret, catalogModels.haiku);
    let [log] = await logsOf(tenant, 1);

    expect(log!.route).toEqual({
      provider: 'anthropic',
      connectionOwner: 'customer',
      connectionId: connection.id,
      vendorModelId: 'claude-haiku-5'
    });
  });

  it('records every attempt of a request that fell back', async () => {
    let tenant = await createTenant();
    await createConnection(tenant, { credentials: { apiKey: 'broken-key' } });
    let token = await createToken(tenant);
    respondPerKey(upstream, { 'broken-key': failing(503, 'overloaded') });

    await chat(token.secret, catalogModels.haiku);
    let [log] = await logsOf(tenant, 1);

    expect(log!.status).toBe('succeeded');
    expect(log!.attempts).toHaveLength(2);
    expect(log!.attempts[0]).toMatchObject({ connectionOwner: 'customer', outcome: 'failed' });
    expect(log!.attempts[0]!.error).toBeTruthy();
    expect(log!.attempts[1]).toMatchObject({
      connectionOwner: 'platform',
      outcome: 'succeeded'
    });
  });

  it('records failed requests with their error', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    upstream.respond(failing(400, 'bad input'));

    await chat(token.secret, catalogModels.haiku);
    let [log] = await logsOf(tenant, 1);

    expect(log).toMatchObject({
      status: 'failed',
      error: { code: 'upstream_invalid_request' }
    });
  });

  it('records requests the gateway rejected', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant, {
      limits: [{ metric: 'requests', amount: 1, interval: '1d' }]
    });

    await chat(token.secret, catalogModels.haiku);
    await chat(token.secret, catalogModels.haiku);

    let rejected = await logsOf(tenant, 1, { status: 'rejected' });
    expect(rejected[0]).toMatchObject({
      status: 'rejected',
      error: { code: 'rate_limit_exceeded' }
    });
    expect(await logsOf(tenant, 1, { status: 'succeeded' })).toHaveLength(1);
  });

  it('records streamed requests with their usage', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    upstream.respond({
      steps: [{ type: 'text', text: 'streamed' }],
      usage: { input: 9, output: 3 }
    });

    await drain(
      await openaiClient(token.secret).chat.completions.create({
        model: catalogModels.haiku,
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true
      })
    );
    let [log] = await logsOf(tenant, 1);

    expect(log).toMatchObject({ status: 'succeeded', operation: expect.any(String) });
    expect(log!.usage).toMatchObject({ input: { total: 9 }, output: { total: 3 } });
  });

  it('prices requests from the offering', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);

    await chat(token.secret, catalogModels.haiku);
    let [log] = await logsOf(tenant, 1);

    expect(log!.cost!.totalUsd).toBeCloseTo(1.41e-4, 9);
  });

  it('prices customer traffic with the connection pricing override', async () => {
    let tenant = await createTenant();
    await createConnection(tenant, { pricingOverride: { multiplier: 2 } });
    let token = await createToken(tenant);

    await chat(token.secret, catalogModels.haiku);
    let [log] = await logsOf(tenant, 1);

    expect(log!.cost!.totalUsd).toBeCloseTo(2.82e-4, 9);
  });

  describe('listing', () => {
    it('filters by token, consumer, model and status', async () => {
      let tenant = await createTenant();
      let [alice, bob] = await Promise.all([
        createToken(tenant, { consumerRef: 'alice' }),
        createToken(tenant, { consumerRef: 'bob' })
      ]);

      await chat(alice.secret, catalogModels.haiku);
      await chat(alice.secret, catalogModels.sonnet);
      await chat(bob.secret, catalogModels.haiku);
      await logsOf(tenant, 3);

      expect(await logsOf(tenant, 2, { gatewayTokenId: alice.id })).toHaveLength(2);
      expect(await logsOf(tenant, 1, { consumerRef: 'bob' })).toHaveLength(1);
      expect(await logsOf(tenant, 2, { modelSlug: catalogModels.haiku })).toHaveLength(2);
      expect(await logsOf(tenant, 0, { status: 'failed' })).toEqual([]);
    });

    it('pages newest first', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant);
      for (let request = 0; request < 3; request++)
        await chat(token.secret, catalogModels.haiku);
      let all = await logsOf(tenant, 3);

      let first = await gateway.inferenceLog.list({
        organizationId: tenant.organization.id,
        instanceId: tenant.instance.id,
        limit: 2
      });
      expect(first.items.map(log => log.id)).toEqual(all.slice(0, 2).map(log => log.id));
      expect(first.hasMore).toBe(true);

      let second = await gateway.inferenceLog.list({
        organizationId: tenant.organization.id,
        instanceId: tenant.instance.id,
        limit: 2,
        before: first.nextCursor!
      });
      expect(second.items.map(log => log.id)).toEqual([all[2]!.id]);
      expect(second.hasMore).toBe(false);
    });

    it('keeps logs inside their organization', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant);
      await chat(token.secret, catalogModels.haiku);
      let [log] = await logsOf(tenant, 1);
      let other = await gateway.organization.upsert({ ref: uniqueId('org') });

      expect((await gateway.inferenceLog.list({ organizationId: other.id })).items).toEqual(
        []
      );
      await expectServiceError(
        gateway.inferenceLog.get({ organizationId: other.id, inferenceLogId: log!.id }),
        'not_found'
      );
    });
  });

  describe('content', () => {
    it('is not stored unless the instance enables content logging', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant);
      await chat(token.secret, catalogModels.haiku);
      let [log] = await logsOf(tenant, 1);

      let fetched = await gateway.inferenceLog.get({
        organizationId: tenant.organization.id,
        inferenceLogId: log!.id,
        includeContent: true
      });

      expect(fetched.hasContent).toBe(false);
      expect(fetched.content).toBeNull();
    });

    it('stores the prompt and response when content logging is on', async () => {
      let tenant = await createTenant({
        settings: { contentLogging: { enabled: true, retentionDays: 3 } }
      });
      let token = await createToken(tenant);
      upstream.respond({ steps: [{ type: 'text', text: 'The secret answer' }] });

      await chat(token.secret, catalogModels.haiku, {
        messages: [{ role: 'user', content: 'The secret question' }]
      });
      let [log] = await logsOf(tenant, 1);
      expect(log!.hasContent).toBe(true);
      expect(log).not.toHaveProperty('content', expect.anything());

      let fetched = await gateway.inferenceLog.get({
        organizationId: tenant.organization.id,
        inferenceLogId: log!.id,
        includeContent: true
      });
      expect(JSON.stringify(fetched.content!.request)).toContain('The secret question');
      expect(JSON.stringify(fetched.content!.response)).toContain('The secret answer');

      let withoutContent = await gateway.inferenceLog.get({
        organizationId: tenant.organization.id,
        inferenceLogId: log!.id
      });
      expect(withoutContent.content).toBeUndefined();
    });
  });

  describe('retention', () => {
    it('expires logs after the instance retention period', async () => {
      let tenant = await createTenant({ logRetentionDays: 2 });
      let token = await createToken(tenant);

      await chat(token.secret, catalogModels.haiku);
      let [log] = await logsOf(tenant, 1);

      let expiresInDays = (new Date(log!.expiresAt).getTime() - Date.now()) / 86_400_000;
      expect(expiresInDays).toBeGreaterThan(1.9);
      expect(expiresInDays).toBeLessThan(2.1);
    });
  });

  describe('usage timeline', () => {
    let range = () => ({
      from: new Date(Date.now() - 3_600_000),
      to: new Date(Date.now() + 3_600_000)
    });

    it('aggregates requests, tokens and cost', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant);
      upstream.respond({
        steps: [{ type: 'text', text: 'ok' }],
        usage: { input: 100, output: 20 }
      });
      for (let request = 0; request < 3; request++)
        await chat(token.secret, catalogModels.haiku);
      await logsOf(tenant, 3);

      let timeline = await gateway.inferenceLog.usageTimeline({ ...tenant.scope, ...range() });

      expect(timeline.object).toBe('ai_gateway#usage_timeline');
      let total = (key: string) =>
        timeline.buckets.reduce((sum: number, bucket: any) => sum + (bucket[key] ?? 0), 0);
      expect(total('requests')).toBe(3);
      expect(total('succeeded')).toBe(3);
      expect(total('inputTokens')).toBe(300);
      expect(total('outputTokens')).toBe(60);
    });

    it('filters by token', async () => {
      let tenant = await createTenant();
      let [a, b] = await Promise.all([createToken(tenant), createToken(tenant)]);
      await chat(a.secret, catalogModels.haiku);
      await chat(b.secret, catalogModels.haiku);
      await chat(b.secret, catalogModels.haiku);
      await logsOf(tenant, 3);

      let timeline = await gateway.inferenceLog.usageTimeline({
        ...tenant.scope,
        ...range(),
        gatewayTokenId: b.id
      });

      expect(
        timeline.buckets.reduce((sum: number, bucket: any) => sum + bucket.requests, 0)
      ).toBe(2);
    });

    it('rejects an empty range', async () => {
      let tenant = await createTenant();
      let now = new Date();

      await expect(
        gateway.inferenceLog.usageTimeline({ ...tenant.scope, from: now, to: now })
      ).rejects.toThrow();
    });
  });
});
