import { expectServiceError, uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { gateway, inferenceRest } from '../support/client';
import { createToken, createTenant, useTenant } from '../support/fixtures';

describe('ai-gateway token api', () => {
  let tenant = useTenant();

  it('creates a token and reveals its secret exactly once', async () => {
    let token = await createToken(tenant, {
      name: 'Backend',
      consumerRef: 'user_1',
      allowedModels: ['anthropic/*'],
      limits: [{ metric: 'tokens', amount: 1000, interval: '1d' }],
      metadata: { team: 'search' }
    });

    expect(token).toMatchObject({
      object: 'ai_gateway#gateway_token',
      name: 'Backend',
      consumerRef: 'user_1',
      allowedModels: ['anthropic/*'],
      limits: [{ metric: 'tokens', amount: 1000, interval: '1d' }],
      metadata: { team: 'search' },
      instance: { id: tenant.instance.id, projectId: tenant.project.id },
      revokedAt: null,
      expiresAt: null,
      lastUsedAt: null
    });
    expect(token.secret).toContain(token.prefix);

    let fetched = await gateway.gatewayToken.get({
      organizationId: tenant.organization.id,
      gatewayTokenId: token.id
    });
    expect(fetched.id).toBe(token.id);
    expect(fetched).not.toHaveProperty('secret');
  });

  it('issues different secrets for every token', async () => {
    let [a, b] = await Promise.all([createToken(tenant), createToken(tenant)]);

    expect(a.secret).not.toBe(b.secret);
    expect(a.prefix).not.toBe(b.prefix);
  });

  it('lists tokens by instance and consumer', async () => {
    let own = await createTenant();
    let consumerRef = uniqueId('consumer');
    let a = await createToken(own, { consumerRef });
    let b = await createToken(own);

    let all = await gateway.gatewayToken.list({
      organizationId: own.organization.id,
      instanceId: own.instance.id
    });
    expect(all.items.map(token => token.id).sort()).toEqual([a.id, b.id].sort());

    let byConsumer = await gateway.gatewayToken.list({
      organizationId: own.organization.id,
      consumerRef
    });
    expect(byConsumer.items.map(token => token.id)).toEqual([a.id]);
  });

  it('paginates the token list', async () => {
    let own = await createTenant();
    await Promise.all([createToken(own), createToken(own), createToken(own)]);

    let first = await gateway.gatewayToken.list({
      organizationId: own.organization.id,
      instanceId: own.instance.id,
      limit: 2
    });
    expect(first.items).toHaveLength(2);
    expect(first.pagination.has_more_after).toBe(true);

    let second = await gateway.gatewayToken.list({
      organizationId: own.organization.id,
      instanceId: own.instance.id,
      limit: 2,
      after: first.items.at(-1)!.id
    });
    expect(second.items).toHaveLength(1);
  });

  it('updates the name, restrictions and expiry', async () => {
    let token = await createToken(tenant);
    let expiresAt = new Date(Date.now() + 3_600_000);

    let updated = await gateway.gatewayToken.update({
      organizationId: tenant.organization.id,
      gatewayTokenId: token.id,
      name: 'Renamed',
      allowedModels: ['openai/gpt-6'],
      limits: [{ metric: 'requests', amount: 5, interval: '1m' }],
      expiresAt
    });
    expect(updated).toMatchObject({
      name: 'Renamed',
      allowedModels: ['openai/gpt-6'],
      limits: [{ metric: 'requests', amount: 5, interval: '1m' }]
    });
    expect(new Date(updated.expiresAt!).getTime()).toBe(expiresAt.getTime());

    let cleared = await gateway.gatewayToken.update({
      organizationId: tenant.organization.id,
      gatewayTokenId: token.id,
      expiresAt: null
    });
    expect(cleared.expiresAt).toBeNull();
  });

  it('revokes a token and stops accepting its secret', async () => {
    let token = await createToken(tenant);
    expect((await inferenceRest(token.secret).get('/v1/models')).status).toBe(200);

    let revoked = await gateway.gatewayToken.revoke({
      organizationId: tenant.organization.id,
      gatewayTokenId: token.id
    });
    expect(revoked.revokedAt).toBeTruthy();

    let response = await inferenceRest(token.secret).get('/v1/models');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('invalid_credential');
  });

  it('does not expose a token through another organization', async () => {
    let token = await createToken(tenant);
    let other = await gateway.organization.upsert({ ref: uniqueId('org') });

    await expectServiceError(
      gateway.gatewayToken.get({ organizationId: other.id, gatewayTokenId: token.id }),
      'not_found'
    );
  });

  it('rejects invalid token input', async () => {
    await expect(createToken(tenant, { name: '' })).rejects.toThrow();
    await expect(
      createToken(tenant, { limits: [{ metric: 'requests', amount: -1, interval: '1h' }] })
    ).rejects.toThrow();
  });
});
