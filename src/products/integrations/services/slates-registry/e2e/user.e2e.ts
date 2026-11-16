import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import {
  createPublisher,
  createTenant,
  expectRpcError,
  publicApi,
  registryClient
} from './helpers';

describe('user E2E', () => {
  it('creates a user with a matching scope', async () => {
    let tenant = await createTenant();
    let identifier = uniqueId('user');

    let user = await registryClient.user.create({
      tenantId: tenant.id,
      identifier,
      name: 'Ada'
    });

    expect(user).toMatchObject({ object: 'user', identifier, name: 'Ada' });
  });

  it('rejects duplicate identifiers across users and workspaces', async () => {
    let tenant = await createTenant();
    let identifier = uniqueId('taken');

    await registryClient.user.create({ tenantId: tenant.id, identifier, name: 'One' });

    await expectRpcError(
      registryClient.user.create({ tenantId: tenant.id, identifier, name: 'Two' }),
      'conflict'
    );
    await expectRpcError(
      registryClient.workspace.create({ tenantId: tenant.id, identifier, name: 'Ws' }),
      'conflict'
    );
  });

  it('rejects duplicate identifiers across tenants', async () => {
    let first = await createTenant();
    let second = await createTenant();
    let identifier = uniqueId('global');

    await registryClient.user.create({ tenantId: first.id, identifier, name: 'One' });

    await expectRpcError(
      registryClient.user.create({ tenantId: second.id, identifier, name: 'Two' }),
      'conflict'
    );
  });

  it('gets, updates and lists users within a tenant', async () => {
    let tenant = await createTenant();
    let users = [];
    for (let i = 0; i < 3; i++) {
      users.push(
        await registryClient.user.create({
          tenantId: tenant.id,
          identifier: uniqueId('user'),
          name: `User ${i}`
        })
      );
    }

    let updated = await registryClient.user.update({
      tenantId: tenant.id,
      userId: users[0]!.id,
      name: 'Renamed',
      description: 'A description'
    });
    expect(updated).toMatchObject({ id: users[0]!.id, name: 'Renamed' });

    let fetched = await registryClient.user.get({ tenantId: tenant.id, userId: users[0]!.id });
    expect(fetched.name).toBe('Renamed');

    let page = await registryClient.user.list({ tenantId: tenant.id, limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.pagination.has_more_after).toBe(true);

    let next = await registryClient.user.list({
      tenantId: tenant.id,
      limit: 2,
      after: page.items[1]!.id
    });
    let seen = [...page.items, ...next.items].map(u => u.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.sort()).toEqual(users.map(u => u.id).sort());
  });

  it('does not expose users of another tenant', async () => {
    let owner = await createPublisher();
    let outsider = await createTenant();

    await expectRpcError(
      registryClient.user.get({ tenantId: outsider.id, userId: owner.user.id }),
      'not_found'
    );
    await expectRpcError(
      registryClient.user.token.create({
        tenantId: outsider.id,
        userId: owner.user.id,
        name: 'stolen'
      }),
      'not_found'
    );

    let listed = await registryClient.user.list({ tenantId: outsider.id });
    expect(listed.items).toHaveLength(0);
  });

  describe('tokens', () => {
    it('returns the secret on create only and redacts it afterwards', async () => {
      let publisher = await createPublisher();

      let created = await registryClient.user.token.create({
        tenantId: publisher.tenant.id,
        userId: publisher.user.id,
        name: 'second'
      });
      expect(created.secret).toEqual(expect.any(String));
      expect(created.secretRedacted).not.toBe(created.secret);

      let fetched = await registryClient.user.token.get({
        tenantId: publisher.tenant.id,
        userId: publisher.user.id,
        tokenId: created.id
      });
      expect(fetched).not.toHaveProperty('secret');
      expect(fetched.status).toBe('active');

      let listed = await registryClient.user.token.list({
        tenantId: publisher.tenant.id,
        userId: publisher.user.id
      });
      expect(listed.items.map(t => t.id)).toContain(created.id);
      expect(JSON.stringify(listed)).not.toContain(created.secret);
    });

    it('stops authenticating after the token is deleted', async () => {
      let publisher = await createPublisher();

      let token = await registryClient.user.token.create({
        tenantId: publisher.tenant.id,
        userId: publisher.user.id,
        name: 'temp'
      });

      let before = await publicApi(token.secret).get('/info');
      expect(before.status).toBe(200);
      expect(before.body.user).toMatchObject({ id: publisher.user.id });

      await registryClient.user.token.delete({
        tenantId: publisher.tenant.id,
        userId: publisher.user.id,
        tokenId: token.id
      });

      let after = await publicApi(token.secret).get('/info');
      expect(after.status).toBe(401);

      await expectRpcError(
        registryClient.user.token.get({
          tenantId: publisher.tenant.id,
          userId: publisher.user.id,
          tokenId: token.id
        }),
        'not_found'
      );
    });
  });
});
