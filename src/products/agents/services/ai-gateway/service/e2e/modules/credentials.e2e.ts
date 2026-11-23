import { eventually, expectServiceError } from '@metorial/e2e';
import { db } from '@mtsrc/ai-gateway-db';
import { getStore } from '@mtsrc/ai-gateway-store';
import { catalogModels } from '@mtsrc/ai-gateway-testing';
import { describe, expect, it } from 'vitest';
import { gateway } from '../support/client';
import {
  chat,
  createConnection,
  createTenant,
  createToken,
  keysOf,
  useCatalog,
  useUpstream
} from '../support/fixtures';

let serialize = (value: unknown) =>
  JSON.stringify(value, (_key, entry) => (typeof entry == 'bigint' ? String(entry) : entry));

describe('ai-gateway credentials module', () => {
  useCatalog();
  let upstream = useUpstream();

  it('keeps provider credentials out of the database', async () => {
    let tenant = await createTenant();
    let apiKey = 'sk-ant-never-stored-in-postgres';

    let connection = await createConnection(tenant, { credentials: { apiKey } });
    let row = await db.providerConnection.findUniqueOrThrow({ where: { id: connection.id } });

    expect(row.nebulaSecretId).toBeTruthy();
    expect(row.credentialHint).toBe(connection.credentialHint);
    expect(serialize(row)).not.toContain(apiKey);
  });

  it('marks a connection invalid when the provider rejects its key', async () => {
    let tenant = await createTenant({ settings: { metorialProvider: { enabled: false } } });
    let connection = await createConnection(tenant);
    let token = await createToken(tenant);
    upstream.failModelLists(401);

    let first = await gateway.providerConnection.check({
      ...tenant.scope,
      connectionId: connection.id
    });
    expect(first).toMatchObject({ status: 'invalid', consecutiveFailures: 1 });
    expect(first.statusMessage).toBeTruthy();
    expect(first.nextCheckAt).toBeTruthy();

    let second = await gateway.providerConnection.check({
      ...tenant.scope,
      connectionId: connection.id
    });
    expect(second.consecutiveFailures).toBe(2);

    upstream.reset();
    let refused = await chat(token.secret, catalogModels.haiku);
    expect(refused.status).toBe(404);
    expect(refused.body.error.code).toBe('model_unavailable');
    expect(upstream.requests).toEqual([]);
  });

  it('recovers a connection once the provider accepts its key again', async () => {
    let tenant = await createTenant({ settings: { metorialProvider: { enabled: false } } });
    let connection = await createConnection(tenant);
    let token = await createToken(tenant);
    upstream.failModelLists(401);
    await gateway.providerConnection.check({ ...tenant.scope, connectionId: connection.id });

    upstream.failModelLists(null);
    let recovered = await gateway.providerConnection.check({
      ...tenant.scope,
      connectionId: connection.id
    });

    expect(recovered).toMatchObject({
      status: 'valid',
      statusMessage: null,
      consecutiveFailures: 0
    });
    expect((await chat(token.secret, catalogModels.haiku)).status).toBe(200);
  });

  it('keeps the status when the provider cannot be reached', async () => {
    let tenant = await createTenant();
    let connection = await createConnection(tenant);
    upstream.failModelLists(503);

    let checked = await gateway.providerConnection.check({
      ...tenant.scope,
      connectionId: connection.id
    });

    expect(checked.status).toBe('valid');
    expect(checked.nextCheckAt).toBeTruthy();
    expect(new Date(checked.nextCheckAt!).getTime()).toBeLessThan(Date.now() + 60 * 60_000);
  });

  it('records every check in the history', async () => {
    let tenant = await createTenant();
    let connection = await createConnection(tenant);
    await gateway.providerConnection.check({ ...tenant.scope, connectionId: connection.id });
    upstream.failModelLists(401);
    await gateway.providerConnection.check({ ...tenant.scope, connectionId: connection.id });

    let store = getStore();
    await store.ready();
    await eventually(async () => {
      let checks = await store.connectionChecks
        .find({ connectionId: connection.id })
        .sort({ checkedAt: 1 })
        .lean();

      expect(checks.map(check => check.outcome)).toEqual(['valid', 'valid', 'invalid']);
      expect(checks[2]).toMatchObject({
        organizationId: tenant.organization.id,
        instanceId: tenant.instance.id,
        providerSlug: 'anthropic',
        httpStatus: 401
      });
      expect(checks[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  it('stops scheduling checks for disabled and archived connections', async () => {
    let tenant = await createTenant();
    let disabled = await createConnection(tenant);
    let archived = await createConnection(tenant);
    expect(disabled.nextCheckAt).toBeTruthy();

    await gateway.providerConnection.setEnabled({
      ...tenant.scope,
      connectionId: disabled.id,
      enabled: false
    });
    await gateway.providerConnection.archive({ ...tenant.scope, connectionId: archived.id });

    let rows = await db.providerConnection.findMany({
      where: { id: { in: [disabled.id, archived.id] } }
    });
    expect(rows.map(row => row.nextCheckAt)).toEqual([null, null]);

    upstream.reset();
    await expectServiceError(
      gateway.providerConnection.update({
        ...tenant.scope,
        connectionId: archived.id,
        name: 'Revived'
      }),
      'not_found'
    );
  });

  it('uses rotated credentials for the very next request', async () => {
    let tenant = await createTenant({ settings: { metorialProvider: { enabled: false } } });
    let connection = await createConnection(tenant, { credentials: { apiKey: 'old-key' } });
    let token = await createToken(tenant);

    await chat(token.secret, catalogModels.haiku);
    await gateway.providerConnection.update({
      ...tenant.scope,
      connectionId: connection.id,
      credentials: { apiKey: 'new-key' }
    });
    await chat(token.secret, catalogModels.haiku);

    expect(keysOf(upstream)).toEqual(['old-key', 'new-key']);
  });
});
