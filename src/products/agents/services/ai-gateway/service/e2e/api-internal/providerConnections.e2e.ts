import { expectServiceError, uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { gateway } from '../support/client';
import {
  createConnection,
  createTenant,
  useCatalog,
  useTenant,
  useUpstream
} from '../support/fixtures';

describe('ai-gateway provider connection api', () => {
  useCatalog();
  let upstream = useUpstream();
  let tenant = useTenant();

  it('validates credentials with the provider before storing them', async () => {
    let apiKey = `sk-ant-${uniqueId('key')}`;

    let connection = await createConnection(tenant, {
      name: 'Production',
      description: 'Primary Anthropic account',
      priority: 5,
      credentials: { apiKey }
    });

    expect(connection).toMatchObject({
      object: 'ai_gateway#provider_connection',
      name: 'Production',
      description: 'Primary Anthropic account',
      priority: 5,
      provider: { slug: 'anthropic' },
      organizationId: tenant.organization.id,
      instance: { id: tenant.instance.id, projectId: tenant.project.id },
      status: 'valid',
      consecutiveFailures: 0,
      archivedAt: null
    });
    expect(connection.lastValidAt).toBeTruthy();
    expect(upstream.modelLists.map(request => request.apiKey)).toContain(apiKey);
  });

  it('never returns the credentials, only a hint', async () => {
    let apiKey = `sk-ant-secret-${uniqueId('key')}`;
    let connection = await createConnection(tenant, { credentials: { apiKey } });

    expect(connection.credentialHint).toBeTruthy();
    expect(connection.credentialHint).not.toBe(apiKey);
    expect(JSON.stringify(connection)).not.toContain(apiKey);

    let fetched = await gateway.providerConnection.get({
      ...tenant.scope,
      connectionId: connection.id
    });
    expect(JSON.stringify(fetched)).not.toContain(apiKey);
  });

  it('rejects credentials the provider refuses', async () => {
    let own = await createTenant();

    let error = await expectServiceError(
      createConnection(own, { credentials: { apiKey: 'invalid-key' } }),
      'invalid_provider_credentials'
    );
    expect((await gateway.providerConnection.list(own.scope)).items).toEqual([]);

    expect(error.message).toContain('Anthropic');
  });

  it('rejects unknown providers and malformed credentials', async () => {
    await expect(
      createConnection(tenant, { providerSlug: 'not-a-provider' })
    ).rejects.toThrow();
    await expect(createConnection(tenant, { credentials: {} })).rejects.toThrow();
  });

  it('supports several providers on one instance', async () => {
    let own = await createTenant();

    let anthropic = await createConnection(own);
    let openai = await createConnection(own, { providerSlug: 'openai' });

    expect(openai.provider.slug).toBe('openai');

    let list = await gateway.providerConnection.list(own.scope);
    expect(list.items.map(connection => connection.id).sort()).toEqual(
      [anthropic.id, openai.id].sort()
    );

    let filtered = await gateway.providerConnection.list({
      ...own.scope,
      providerSlug: 'openai'
    });
    expect(filtered.items.map(connection => connection.id)).toEqual([openai.id]);
  });

  it('keeps connections private to their instance', async () => {
    let connection = await createConnection(tenant);
    let other = await createTenant();

    await expectServiceError(
      gateway.providerConnection.get({ ...other.scope, connectionId: connection.id }),
      'not_found'
    );

    let list = await gateway.providerConnection.list(other.scope);
    expect(list.items).toEqual([]);
  });

  it('updates metadata without touching the credentials', async () => {
    let connection = await createConnection(tenant, { name: 'Before' });
    upstream.reset();

    let updated = await gateway.providerConnection.update({
      ...tenant.scope,
      connectionId: connection.id,
      name: 'After',
      priority: 50,
      features: { zdr: true },
      pricingOverride: { multiplier: 1.5 }
    });

    expect(updated).toMatchObject({
      name: 'After',
      priority: 50,
      features: { zdr: true },
      pricingOverride: { multiplier: 1.5 },
      credentialHint: connection.credentialHint
    });
    expect(upstream.modelLists).toEqual([]);
  });

  it('replaces credentials only after validating the new ones', async () => {
    let connection = await createConnection(tenant);

    await expectServiceError(
      gateway.providerConnection.update({
        ...tenant.scope,
        connectionId: connection.id,
        credentials: { apiKey: 'invalid-replacement' }
      }),
      'invalid_provider_credentials'
    );

    let replacement = `sk-ant-${uniqueId('rotated')}`;
    let updated = await gateway.providerConnection.update({
      ...tenant.scope,
      connectionId: connection.id,
      credentials: { apiKey: replacement }
    });

    expect(updated.credentialHint).not.toBe(connection.credentialHint);
    expect(upstream.modelLists.map(request => request.apiKey)).toContain(replacement);
  });

  it('re-checks a connection on demand', async () => {
    let connection = await createConnection(tenant);
    upstream.reset();

    let checked = await gateway.providerConnection.check({
      ...tenant.scope,
      connectionId: connection.id
    });

    expect(checked.status).toBe('valid');
    expect(upstream.modelLists).toHaveLength(1);
    expect(new Date(checked.lastCheckedAt!).getTime()).toBeGreaterThanOrEqual(
      new Date(connection.lastCheckedAt!).getTime()
    );
  });

  it('disables and re-enables a connection', async () => {
    let connection = await createConnection(tenant);

    let disabled = await gateway.providerConnection.setEnabled({
      ...tenant.scope,
      connectionId: connection.id,
      enabled: false
    });
    expect(disabled.status).toBe('disabled');

    let enabled = await gateway.providerConnection.setEnabled({
      ...tenant.scope,
      connectionId: connection.id,
      enabled: true
    });
    expect(enabled.status).toBe('valid');
  });

  it('filters connections by status', async () => {
    let own = await createTenant();
    let active = await createConnection(own);
    let disabled = await createConnection(own);
    await gateway.providerConnection.setEnabled({
      ...own.scope,
      connectionId: disabled.id,
      enabled: false
    });

    let list = await gateway.providerConnection.list({ ...own.scope, status: ['disabled'] });
    expect(list.items.map(connection => connection.id)).toEqual([disabled.id]);

    let valid = await gateway.providerConnection.list({ ...own.scope, status: ['valid'] });
    expect(valid.items.map(connection => connection.id)).toEqual([active.id]);
  });

  it('archives a connection and drops it from the list', async () => {
    let own = await createTenant();
    let connection = await createConnection(own);

    let archived = await gateway.providerConnection.archive({
      ...own.scope,
      connectionId: connection.id
    });
    expect(archived.archivedAt).toBeTruthy();

    let list = await gateway.providerConnection.list(own.scope);
    expect(list.items).toEqual([]);
  });
});
