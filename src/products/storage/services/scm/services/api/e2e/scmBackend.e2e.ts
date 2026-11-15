import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { getId } from '../src/id';
import { origin } from './client';
import { expectRpcError } from './errors';
import { createBackend, createTenant } from './fixtures';

let githubEnterprise = (name = uniqueId('ghe')) => ({
  type: 'github_enterprise' as const,
  name,
  apiUrl: 'https://ghe.example.test/api/v3',
  webUrl: 'https://ghe.example.test',
  appId: '12345',
  appSlug: 'my-app',
  appPrivateKey: 'private-key',
  clientId: uniqueId('client'),
  clientSecret: uniqueId('secret')
});

let createDefaultBackend = async () => {
  let identifier = uniqueId('default');

  return db.scmBackend.create({
    data: {
      ...getId('scmBackend'),
      defaultIdentifier: identifier,
      type: 'gitlab',
      name: 'Default GitLab',
      apiUrl: 'https://gitlab.com/api/v4',
      webUrl: 'https://gitlab.com',
      clientId: 'client',
      isDefault: true
    }
  });
};

describe('origin scm backend', () => {
  it('creates, gets, updates and deletes a backend', async () => {
    let tenant = await createTenant();

    let created = await createBackend(tenant.id, {
      name: 'Self Hosted',
      description: 'Internal GitLab'
    });
    expect(created).toMatchObject({
      object: 'origin#scmBackend',
      type: 'gitlab_selfhosted',
      name: 'Self Hosted',
      description: 'Internal GitLab',
      apiUrl: 'https://gitlab.example.test/api/v4',
      webUrl: 'https://gitlab.example.test',
      isDefault: false,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });

    let fetched = await origin.scmBackend.get({ tenantId: tenant.id, backendId: created.id });
    expect(fetched).toMatchObject({ id: created.id, name: 'Self Hosted' });

    let updated = await origin.scmBackend.update({
      tenantId: tenant.id,
      backendId: created.id,
      name: 'Renamed',
      description: 'New description'
    });
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Renamed',
      description: 'New description',
      apiUrl: created.apiUrl
    });

    let row = await db.scmBackend.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({ name: 'Renamed', description: 'New description' });

    expect(
      await origin.scmBackend.delete({ tenantId: tenant.id, backendId: created.id })
    ).toEqual({ success: true });
    expect(await db.scmBackend.count({ where: { id: created.id } })).toBe(0);

    await expectRpcError(
      origin.scmBackend.get({ tenantId: tenant.id, backendId: created.id }),
      'not_found'
    );
  });

  it('stores secrets outside the backend row and never exposes them', async () => {
    let tenant = await createTenant();
    let input = githubEnterprise();

    let created = await origin.scmBackend.create({ tenantId: tenant.id, ...input });
    expect(created.hasCredentials).toBe(true);
    expect(created.appSlug).toBe('my-app');

    let keys = Object.keys(created);
    for (let secret of [
      'clientSecret',
      'appPrivateKey',
      'appId',
      'clientId',
      'appWebhookSecret'
    ])
      expect(keys).not.toContain(secret);
    expect(JSON.stringify(created)).not.toContain(input.clientSecret);
    expect(JSON.stringify(created)).not.toContain(input.appPrivateKey);

    let row = await db.scmBackend.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.tenantOid).toBe(tenant.oid);
    expect(row.clientId).toBe(input.clientId);
    expect(row.clientSecret).toBeNull();
    expect(row.clientSecretNebulaSecretId).toEqual(expect.any(String));
    expect(row.appPrivateKey).toBeNull();
    expect(row.appPrivateKeyNebulaSecretId).toEqual(expect.any(String));
  });

  it('rotates a secret on update without exposing it', async () => {
    let tenant = await createTenant();
    let created = await createBackend(tenant.id);
    let before = await db.scmBackend.findUniqueOrThrow({ where: { id: created.id } });

    let updated = await origin.scmBackend.update({
      tenantId: tenant.id,
      backendId: created.id,
      clientId: 'new-client-id',
      clientSecret: 'rotated-secret'
    });
    expect(JSON.stringify(updated)).not.toContain('rotated-secret');

    let after = await db.scmBackend.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.clientId).toBe('new-client-id');
    expect(after.clientSecret).toBeNull();
    expect(after.clientSecretNebulaSecretId).toEqual(expect.any(String));
    expect(before.clientSecretNebulaSecretId).toEqual(expect.any(String));
  });

  it('only updates the provided fields', async () => {
    let tenant = await createTenant();
    let created = await createBackend(tenant.id, { description: 'Keep Me' });

    let updated = await origin.scmBackend.update({
      tenantId: tenant.id,
      backendId: created.id,
      name: 'Only Name'
    });

    expect(updated).toMatchObject({ name: 'Only Name', description: 'Keep Me' });
  });

  it('lists the backends of the tenant and the default backends', async () => {
    let tenant = await createTenant();
    let other = await createTenant();
    let fallback = await createDefaultBackend();

    let first = await createBackend(tenant.id);
    let second = await createBackend(tenant.id);
    let foreign = await createBackend(other.id);

    let list = await origin.scmBackend.list({ tenantId: tenant.id, limit: 100 });
    let ids = list.items.map(item => item.id);

    expect(ids).toEqual(expect.arrayContaining([first.id, second.id, fallback.id]));
    expect(ids).not.toContain(foreign.id);
  });

  it('pages through backends', async () => {
    let tenant = await createTenant();
    let created = await Promise.all([
      createBackend(tenant.id),
      createBackend(tenant.id),
      createBackend(tenant.id)
    ]);

    let seen: string[] = [];
    let after: string | undefined;

    for (let page = 0; page < 50; page++) {
      let result = await origin.scmBackend.list({ tenantId: tenant.id, limit: 1, after });
      expect(result.items.length).toBeLessThanOrEqual(1);
      seen.push(...result.items.map(item => item.id));
      if (!result.pagination.has_more_after) break;
      after = result.items[result.items.length - 1]!.id;
    }

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual(expect.arrayContaining(created.map(item => item.id)));
  });

  it('makes default backends readable but immutable', async () => {
    let tenant = await createTenant();
    let fallback = await createDefaultBackend();

    let fetched = await origin.scmBackend.get({ tenantId: tenant.id, backendId: fallback.id });
    expect(fetched).toMatchObject({ id: fallback.id, isDefault: true });

    let update = await expectRpcError(
      origin.scmBackend.update({
        tenantId: tenant.id,
        backendId: fallback.id,
        name: 'Hacked'
      }),
      'bad_request'
    );
    expect(update.message).toContain('default backend');

    let remove = await expectRpcError(
      origin.scmBackend.delete({ tenantId: tenant.id, backendId: fallback.id }),
      'bad_request'
    );
    expect(remove.message).toContain('default backend');

    let row = await db.scmBackend.findUniqueOrThrow({ where: { id: fallback.id } });
    expect(row.name).toBe('Default GitLab');
  });

  it('isolates backends between tenants', async () => {
    let owner = await createTenant();
    let other = await createTenant();
    let backend = await createBackend(owner.id);

    await expectRpcError(
      origin.scmBackend.get({ tenantId: other.id, backendId: backend.id }),
      'not_found'
    );
    await expectRpcError(
      origin.scmBackend.update({ tenantId: other.id, backendId: backend.id, name: 'Stolen' }),
      'not_found'
    );
    await expectRpcError(
      origin.scmBackend.delete({ tenantId: other.id, backendId: backend.id }),
      'not_found'
    );

    let row = await db.scmBackend.findUniqueOrThrow({ where: { id: backend.id } });
    expect(row.name).toBe(backend.name);
  });

  it('rejects an unknown backend', async () => {
    let tenant = await createTenant();

    await expectRpcError(
      origin.scmBackend.get({ tenantId: tenant.id, backendId: uniqueId('missing') }),
      'not_found'
    );
  });

  it('requires app credentials for GitHub Enterprise', async () => {
    let tenant = await createTenant();

    for (let missing of ['appId', 'appSlug', 'appPrivateKey'] as const) {
      let input: Record<string, unknown> = githubEnterprise();
      delete input[missing];

      let error = await expectRpcError(
        origin.scmBackend.create({ tenantId: tenant.id, ...(input as any) }),
        'bad_request'
      );
      expect(error.message).toContain('appId, appSlug, and appPrivateKey');
    }
  });

  it('rejects invalid URLs', async () => {
    let tenant = await createTenant();

    let error = await expectRpcError(
      createBackend(tenant.id, { apiUrl: 'not a url' }),
      'bad_request'
    );
    expect(error.message).toBe('Invalid URL format');

    await expectRpcError(
      createBackend(tenant.id, { webUrl: 'also not a url' }),
      'bad_request'
    );
  });

  it('validates the create input', async () => {
    let tenant = await createTenant();

    await expectRpcError(createBackend(tenant.id, { type: 'svn' }), 'invalid_data');
    await expectRpcError(createBackend(tenant.id, { clientId: undefined }), 'invalid_data');
    await expectRpcError(
      createBackend(tenant.id, { clientSecret: undefined }),
      'invalid_data'
    );
    await expectRpcError(createBackend(tenant.id, { name: undefined }), 'invalid_data');
  });

  it('does not allow creating hosted provider backends in the cloud edition', async () => {
    let tenant = await createTenant();

    await expectRpcError(
      createBackend(tenant.id, {
        type: 'github',
        apiUrl: 'https://api.github.com',
        webUrl: 'https://github.com'
      }),
      'invalid_data'
    );
  });

  it('does not leave a row behind when creation fails', async () => {
    let tenant = await createTenant();
    let name = uniqueId('failing');

    await expectRpcError(createBackend(tenant.id, { name, apiUrl: 'nope' }), 'bad_request');

    expect(await db.scmBackend.count({ where: { name } })).toBe(0);
  });
});
