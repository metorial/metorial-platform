import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { anthropicHeaders, gateway, inferenceRest } from '../support/client';
import {
  chat,
  createConnection,
  createTenant,
  createToken,
  useCatalog,
  useUpstream
} from '../support/fixtures';

describe('ai-gateway inference limits', () => {
  useCatalog();
  let upstream = useUpstream();

  let tripsAfter = async (call: () => Promise<{ status: number }>, max = 8) => {
    let successes = 0;
    for (let attempt = 0; attempt < max; attempt++) {
      if ((await call()).status != 200) return successes;
      successes++;
    }
    throw new Error(`The limit did not trip within ${max} requests`);
  };

  describe('token limits', () => {
    it('stops a token at its request limit', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant, {
        limits: [{ metric: 'requests', amount: 2, interval: '1d' }]
      });

      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);
      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);
      let limited = await chat(token.secret, catalogModels.haiku);

      expect(limited.status).toBe(429);
      expect(limited.body.error).toMatchObject({
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded'
      });
      expect(limited.body.error.message).toContain(
        'This API key is limited to 2 requests per day'
      );
      expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(upstream.requests).toHaveLength(2);
    });

    it('limits per token, not per instance', async () => {
      let tenant = await createTenant();
      let limits = [{ metric: 'requests' as const, amount: 1, interval: '1d' as const }];
      let [first, second] = await Promise.all([
        createToken(tenant, { limits }),
        createToken(tenant, { limits })
      ]);

      expect((await chat(first.secret, catalogModels.haiku)).status).toBe(200);
      expect((await chat(first.secret, catalogModels.haiku)).status).toBe(429);
      expect((await chat(second.secret, catalogModels.haiku)).status).toBe(200);
    });

    it('answers limit errors in the Anthropic format', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant, {
        limits: [{ metric: 'requests', amount: 1, interval: '1d' }]
      });
      let call = () =>
        inferenceRest(token.secret).post('/v1/messages', {
          body: {
            model: catalogModels.haiku,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          },
          headers: anthropicHeaders
        });

      expect((await call()).status).toBe(200);
      let limited = await call();

      expect(limited.status).toBe(429);
      expect(limited.body).toMatchObject({
        type: 'error',
        error: { type: 'rate_limit_error' }
      });
    });

    it('refuses a request larger than the token limit', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant, {
        limits: [{ metric: 'tokens', amount: 50, interval: '1d' }]
      });

      let response = await chat(token.secret, catalogModels.haiku, {
        messages: [{ role: 'user', content: 'lorem ipsum '.repeat(500) }]
      });

      expect(response.status).toBe(429);
      expect(response.body.error.message).toContain('only allows 50 tokens per day');
      expect(upstream.requests).toEqual([]);
    });

    it('stops a token at its spend limit', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant, {
        limits: [{ metric: 'spend_usd', amount: 0.0002, interval: '1d' }]
      });

      let successes = await tripsAfter(() => chat(token.secret, catalogModels.haiku));
      expect(successes).toBeGreaterThanOrEqual(1);
      expect(successes).toBeLessThanOrEqual(3);

      let limited = await chat(token.secret, catalogModels.haiku);
      expect(limited.body.error.code).toBe('spend_limit_exceeded');
    });

    it('applies a changed limit to a token already in use', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant);
      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);

      await gateway.gatewayToken.update({
        organizationId: tenant.organization.id,
        gatewayTokenId: token.id,
        limits: [{ metric: 'requests', amount: 1, interval: '1d' }]
      });

      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);
      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(429);
    });
  });

  describe('instance limits', () => {
    it('are shared by every token of the instance', async () => {
      let tenant = await createTenant({
        limits: [{ metric: 'requests', amount: 2, interval: '1d' }]
      });
      let [first, second] = await Promise.all([createToken(tenant), createToken(tenant)]);

      expect((await chat(first.secret, catalogModels.haiku)).status).toBe(200);
      expect((await chat(second.secret, catalogModels.haiku)).status).toBe(200);

      let limited = await chat(first.secret, catalogModels.haiku);
      expect(limited.status).toBe(429);
      expect(limited.body.error.message).toContain('This gateway instance');
    });

    it('do not leak into other instances', async () => {
      let limited = await createTenant({
        limits: [{ metric: 'requests', amount: 1, interval: '1d' }]
      });
      let other = await createTenant();
      let [limitedToken, otherToken] = await Promise.all([
        createToken(limited),
        createToken(other)
      ]);

      await chat(limitedToken.secret, catalogModels.haiku);
      expect((await chat(limitedToken.secret, catalogModels.haiku)).status).toBe(429);
      expect((await chat(otherToken.secret, catalogModels.haiku)).status).toBe(200);
    });
  });

  describe('platform limits', () => {
    let limitProject = (
      tenant: Awaited<ReturnType<typeof createTenant>>,
      limits: Parameters<typeof gateway.platformLimit.sync>[0]['limits']
    ) => gateway.platformLimit.sync({ projectId: tenant.project.id, limits });

    it('stop a project at the limit of its plan', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant);
      await limitProject(tenant, [{ metric: 'requests', amount: 2, intervalSeconds: 86_400 }]);

      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);
      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);
      let limited = await chat(token.secret, catalogModels.haiku);

      expect(limited.status).toBe(429);
      expect(limited.body.error.code).toBe('plan_limit_exceeded');
      expect(limited.body.error.message).toContain("This project's plan");
    });

    it('apply to every instance and token of the project', async () => {
      let tenant = await createTenant();
      let second = await gateway.instance.upsert({
        organizationId: tenant.organization.id,
        projectId: tenant.project.id,
        ref: `${tenant.instance.ref}-second`
      });
      let [a, b] = await Promise.all([
        createToken(tenant),
        gateway.gatewayToken.create({
          organizationId: tenant.organization.id,
          instanceId: second.id,
          name: 'second'
        })
      ]);
      await limitProject(tenant, [{ metric: 'requests', amount: 1, intervalSeconds: 86_400 }]);

      expect((await chat(a.secret, catalogModels.haiku)).status).toBe(200);
      expect((await chat(b.secret, catalogModels.haiku)).status).toBe(429);
    });

    it('count Metorial spend only', async () => {
      let tenant = await createTenant();
      await createConnection(tenant, { credentials: { apiKey: 'customer-key' } });
      let token = await createToken(tenant);
      await limitProject(tenant, [
        { metric: 'metorial_spend_usd', amount: 0.00005, intervalSeconds: 86_400 }
      ]);

      for (let request = 0; request < 4; request++) {
        expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);
      }
      expect(
        upstream.requests.every(request => request.headers['x-api-key'] == 'customer-key')
      ).toBe(true);

      let platform = await createToken(tenant);
      let successes = await tripsAfter(() =>
        chat(platform.secret, `metorial:${catalogModels.haiku}`)
      );
      expect(successes).toBeGreaterThanOrEqual(1);
      expect(successes).toBeLessThanOrEqual(2);

      let limited = await chat(platform.secret, `metorial:${catalogModels.haiku}`);
      expect(limited.body.error.code).toBe('plan_limit_exceeded');
      expect(limited.body.error.message).toContain('Metorial-billed usage');
    });

    it('are lifted when the plan changes', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant);
      await limitProject(tenant, [{ metric: 'requests', amount: 1, intervalSeconds: 86_400 }]);
      await chat(token.secret, catalogModels.haiku);
      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(429);

      await limitProject(tenant, []);

      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);
    });
  });

  describe('project restrictions', () => {
    it('block a disabled project completely', async () => {
      let tenant = await createTenant();
      await createConnection(tenant);
      let token = await createToken(tenant);
      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);

      let project = await gateway.platformLimit.sync({
        projectId: tenant.project.id,
        limits: [],
        disabled: { reason: 'Terms of service violation' }
      });
      expect(project.disabled).toMatchObject({ reason: 'Terms of service violation' });

      let blocked = await chat(token.secret, catalogModels.haiku);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error.code).toBe('gateway_disabled');
      expect(blocked.body.error.message).toContain('Terms of service violation');

      await gateway.platformLimit.sync({
        projectId: tenant.project.id,
        limits: [],
        disabled: null
      });
      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);
    });

    it('block Metorial billed traffic when billing restricts the project', async () => {
      let tenant = await createTenant();
      let token = await createToken(tenant);

      let restricted = await gateway.billing.setRestriction({
        projectId: tenant.project.id,
        restriction: { reason: 'Credits exhausted.' }
      });
      expect(restricted.billingRestriction).toMatchObject({ reason: 'Credits exhausted.' });

      let blocked = await chat(token.secret, catalogModels.haiku);
      expect(blocked.status).toBe(402);
      expect(blocked.body.error.code).toBe('billing_restricted');
      expect(blocked.body.error.message).toContain(
        'Requests over your own provider connections are not affected'
      );
      expect(upstream.requests).toEqual([]);

      await createConnection(tenant, { credentials: { apiKey: 'customer-key' } });
      expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);

      await gateway.billing.setRestriction({
        projectId: tenant.project.id,
        restriction: null
      });
      expect((await chat(token.secret, `metorial:${catalogModels.haiku}`)).status).toBe(200);
    });
  });
});
