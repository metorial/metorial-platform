import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { ares } from './client';
import { createApp, expectRpcStatus } from './fixtures';

let createTenant = (
  appId: string,
  overrides: Partial<{ name: string; enrollment: 'app' | 'account' }> = {}
) =>
  ares.ssoV2.tenants.create({
    appId,
    name: overrides.name ?? uniqueId('tenant'),
    enrollment: overrides.enrollment ?? 'app'
  });

describe('ares sso tenants', () => {
  it('creates a tenant and persists it', async () => {
    let app = await createApp();

    let tenant = await ares.ssoV2.tenants.create({
      appId: app.id,
      name: 'Acme',
      enrollment: 'app',
      externalId: 'acme-1',
      metadata: { plan: 'enterprise' }
    });

    expect(tenant).toMatchObject({
      object: 'ares#ssoTenant',
      name: 'Acme',
      enrollment: 'app',
      externalId: 'acme-1',
      metadata: { plan: 'enterprise' },
      hideInUI: false,
      source: 'local',
      isEditable: true
    });

    let row = await db.ssoTenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(row.name).toBe('Acme');
  });

  it('starts account enrollment tenants as disabled until assigned', async () => {
    let app = await createApp();
    let tenant = await createTenant(app.id, { enrollment: 'account' });
    expect(tenant.enrollment).toBe('disabled');
  });

  it('rejects creating a tenant for an unknown app or with a bad enrollment', async () => {
    await expectRpcStatus(createTenant('app_missing'), 404);

    let app = await createApp();
    await expectRpcStatus(
      ares.ssoV2.tenants.create({ appId: app.id, name: 'x', enrollment: 'nope' as any }),
      400
    );
  });

  it('gets and updates a tenant', async () => {
    let app = await createApp();
    let tenant = await createTenant(app.id);

    expect(await ares.ssoV2.tenants.get({ tenantId: tenant.id })).toMatchObject({
      id: tenant.id,
      name: tenant.name
    });

    let updated = await ares.ssoV2.tenants.update({
      tenantId: tenant.id,
      name: 'Renamed',
      hideInUI: true
    });
    expect(updated).toMatchObject({ id: tenant.id, name: 'Renamed', hideInUI: true });

    let row = await db.ssoTenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(row.name).toBe('Renamed');
    expect(row.hideInUI).toBe(true);
  });

  it('rejects unknown tenants', async () => {
    await expectRpcStatus(ares.ssoV2.tenants.get({ tenantId: 'ssoTenant_missing' }), 404);
    await expectRpcStatus(
      ares.ssoV2.tenants.update({ tenantId: 'ssoTenant_missing', name: 'x' }),
      404
    );
  });

  it('lists only the tenants of the app', async () => {
    let app = await createApp();
    let other = await createApp();

    let first = await createTenant(app.id);
    let second = await createTenant(app.id);
    let foreign = await createTenant(other.id);

    let list = await ares.ssoV2.tenants.list({ appId: app.id, limit: 50 });
    let ids = list.items.map(i => i.id);

    expect([...ids].sort()).toEqual([first.id, second.id].sort());
    expect(ids).not.toContain(foreign.id);
  });

  it('pages through tenants', async () => {
    let app = await createApp();
    let created = await Promise.all([
      createTenant(app.id),
      createTenant(app.id),
      createTenant(app.id)
    ]);

    let seen: string[] = [];
    let after: string | undefined;

    for (let page = 0; page < 5; page++) {
      let result = await ares.ssoV2.tenants.list({ appId: app.id, limit: 1, after });
      seen.push(...result.items.map(i => i.id));
      if (!result.pagination.has_more_after) break;
      after = result.items[result.items.length - 1]!.id;
    }

    expect([...seen].sort()).toEqual(created.map(c => c.id).sort());
  });

  it('returns an empty sync snapshot for a new tenant', async () => {
    let app = await createApp();
    let tenant = await createTenant(app.id);

    let snapshot = await ares.ssoV2.tenants.getSyncSnapshot({ tenantId: tenant.id });

    expect(snapshot).toMatchObject({
      object: 'ares#ssoTenantSyncSnapshot',
      tenant: { id: tenant.id, appId: app.id },
      groups: [],
      roles: []
    });
  });

  it('creates a setup link for a tenant', async () => {
    let app = await createApp();
    let tenant = await createTenant(app.id);

    let setup = await ares.ssoV2.tenants.createSetup({
      tenantId: tenant.id,
      redirectUri: 'https://app.example.com/sso/done'
    });

    expect(setup).toMatchObject({
      object: 'ares#ssoSetup',
      redirectUri: 'https://app.example.com/sso/done'
    });
    expect(setup.setupUrl).toContain('/sso/setup?clientSecret=');
  });
});

describe('ares accounts', () => {
  let upsertAccount = (
    appId: string,
    overrides: Partial<Parameters<typeof ares.ssoV2.accounts.upsert>[0]> = {}
  ) =>
    ares.ssoV2.accounts.upsert({
      appId,
      identifier: uniqueId('account'),
      name: 'Account',
      ssoTenants: [],
      accountDomains: [],
      ...overrides
    });

  it('upserts an account by identifier without duplicating it', async () => {
    let app = await createApp();
    let identifier = uniqueId('account');

    let created = await upsertAccount(app.id, { identifier, name: 'First' });
    let updated = await upsertAccount(app.id, { identifier, name: 'Second' });

    expect(created).toMatchObject({ identifier, name: 'First', status: 'active' });
    expect(updated).toMatchObject({ id: created.id, name: 'Second' });
    expect(await db.account.count({ where: { identifier } })).toBe(1);
  });

  it('attaches tenants and domains and normalizes domains', async () => {
    let app = await createApp();
    let tenant = await createTenant(app.id, { enrollment: 'account' });

    let account = await upsertAccount(app.id, {
      ssoTenants: [{ id: tenant.id }],
      accountDomains: [{ domain: 'Corp.Example.COM' }]
    });

    expect(account.ssoTenants.map(t => t.id)).toEqual([tenant.id]);
    expect(account.domains.map(d => d.domain)).toEqual(['corp.example.com']);
  });

  it('rejects invalid and duplicate domains and blank names', async () => {
    let app = await createApp();

    await expectRpcStatus(
      upsertAccount(app.id, { accountDomains: [{ domain: 'user@corp.com' }] }),
      400
    );
    await expectRpcStatus(
      upsertAccount(app.id, {
        accountDomains: [{ domain: 'corp.com' }, { domain: 'CORP.com' }]
      }),
      400
    );
    await expectRpcStatus(upsertAccount(app.id, { name: '   ' }), 400);
  });

  it('gets, lists and filters accounts per app', async () => {
    let app = await createApp();
    let other = await createApp();

    let account = await upsertAccount(app.id, { name: 'Findable Inc' });
    let foreign = await upsertAccount(other.id);

    expect(await ares.ssoV2.accounts.get({ accountId: account.id })).toMatchObject({
      id: account.id
    });

    let list = await ares.ssoV2.accounts.list({ appId: app.id, limit: 50 });
    expect(list.items.map(i => i.id)).toEqual([account.id]);
    expect(list.items.map(i => i.id)).not.toContain(foreign.id);

    let byIdentifier = await ares.ssoV2.accounts.list({
      appId: app.id,
      limit: 50,
      identifier: account.identifier
    });
    expect(byIdentifier.items).toHaveLength(1);

    let miss = await ares.ssoV2.accounts.list({
      appId: app.id,
      limit: 50,
      search: 'zzz-none'
    });
    expect(miss.items).toHaveLength(0);
  });

  it('rejects an unknown account', async () => {
    await expectRpcStatus(ares.ssoV2.accounts.get({ accountId: 'account_missing' }), 404);
  });

  it('deletes an account asynchronously', async () => {
    let app = await createApp();
    let account = await upsertAccount(app.id);

    let result = await ares.ssoV2.accounts.delete({ accountId: account.id });
    expect(result.id).toBe(account.id);
    expect(result.status).toBe('deleting');
  });
});
