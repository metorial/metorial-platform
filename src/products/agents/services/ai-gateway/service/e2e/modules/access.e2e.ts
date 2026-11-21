import { eventually } from '@metorial/e2e';
import { db } from '@mtsrc/ai-gateway-db';
import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { gateway, inferenceRest } from '../support/client';
import { chat, createTenant, createToken, useCatalog, useUpstream } from '../support/fixtures';

let serialize = (value: unknown) =>
  JSON.stringify(value, (_key, entry) => (typeof entry == 'bigint' ? String(entry) : entry));

describe('ai-gateway access module', () => {
  useCatalog();
  useUpstream();

  it('stores only a hash of the token secret', async () => {
    let tenant = await createTenant();

    let token = await createToken(tenant);
    let row = await db.gatewayToken.findUniqueOrThrow({ where: { id: token.id } });

    expect(row.prefix).toBe(token.prefix);
    expect(row.secretHash).toBeTruthy();
    expect(row.secretHash).not.toBe(token.secret);
    expect(serialize(row)).not.toContain(token.secret);
    expect(token.secret).toContain(row.prefix);
  });

  it('records when a token was last used', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    expect(token.lastUsedAt).toBeNull();

    await chat(token.secret, catalogModels.haiku);

    await eventually(async () => {
      let fetched = await gateway.gatewayToken.get({
        organizationId: tenant.organization.id,
        gatewayTokenId: token.id
      });
      expect(fetched.lastUsedAt).toBeTruthy();
    });
  });

  it('applies instance setting changes to tokens that are already cached', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);

    await gateway.instance.upsert({
      organizationId: tenant.organization.id,
      projectId: tenant.project.id,
      ref: tenant.instance.ref,
      settings: { metorialProvider: { enabled: false } }
    });

    let response = await chat(token.secret, catalogModels.haiku);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('model_unavailable');
  });

  it('stops accepting tokens of an archived instance', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    expect((await inferenceRest(token.secret).get('/v1/models')).status).toBe(200);

    await gateway.instance.archive(tenant.scope);

    let response = await inferenceRest(token.secret).get('/v1/models');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('invalid_credential');
  });

  it('stops accepting tokens of an archived project', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    expect((await inferenceRest(token.secret).get('/v1/models')).status).toBe(200);

    await gateway.project.archive({
      organizationId: tenant.organization.id,
      projectId: tenant.project.id
    });

    expect((await inferenceRest(token.secret).get('/v1/models')).status).toBe(401);
  });

  it('stops accepting tokens of an archived organization', async () => {
    let tenant = await createTenant();
    let token = await createToken(tenant);
    expect((await inferenceRest(token.secret).get('/v1/models')).status).toBe(200);

    await gateway.organization.archive({ organizationId: tenant.organization.id });

    expect((await inferenceRest(token.secret).get('/v1/models')).status).toBe(401);
  });

  it('does not let an archived scope accept a new token', async () => {
    let tenant = await createTenant();
    await gateway.instance.archive(tenant.scope);

    await expect(createToken(tenant)).rejects.toThrow();
  });

  it('keeps tokens of different instances apart', async () => {
    let [a, b] = await Promise.all([createTenant(), createTenant()]);
    let [tokenA, tokenB] = await Promise.all([createToken(a), createToken(b)]);

    await gateway.instance.archive(a.scope);

    expect((await inferenceRest(tokenA.secret).get('/v1/models')).status).toBe(401);
    expect((await inferenceRest(tokenB.secret).get('/v1/models')).status).toBe(200);
  });
});
