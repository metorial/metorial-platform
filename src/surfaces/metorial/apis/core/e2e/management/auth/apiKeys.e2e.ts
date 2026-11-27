import {
  API_VERSIONS,
  authClients,
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';

describe('api-core management: api keys', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let dashboardPath = (path: string) =>
    `/dashboard/organizations/${org.ids.organizationId}${path}`;

  let instanceKeysQuery = () => ({
    type: 'instance_access_token',
    instance_id: org.ids.instanceId
  });

  let createKey = async (
    body: Record<string, unknown> = {},
    client = org.clients.management
  ) =>
    expectOk(
      await client.post(
        client === org.clients.rest ? dashboardPath('/api-keys') : '/organization/api-keys',
        {
          type: 'instance_access_token_secret',
          instance_id: org.ids.instanceId,
          name: uniqueId('rest-key'),
          ...body
        }
      )
    );

  let instanceApi = (apiKey: string) =>
    rest(metorialEndpoints().api, { apiKey, version: API_VERSIONS.magnetar });

  it('authenticates api key routes per credential', async () => {
    let clients = authClients(org, {
      otherSession: rest(metorialEndpoints().api, { session: otherOrg.session })
    });
    let isDashboard = (name: string) => name === 'session' || name === 'otherSession';

    let responses = await expectAuthMatrix(
      clients,
      (client, name) =>
        client.get(isDashboard(name) ? dashboardPath('/api-keys') : '/organization/api-keys', {
          query: { type: 'organization_management_token' }
        }),
      { none: 401, session: 200, management: 200, instance: 403, otherSession: [403, 404] }
    );
    expect(responses.session.body.items.length).toBeGreaterThan(0);
    expect(
      responses.management.body.items.every(
        (item: any) => item.type === 'organization_management_token'
      )
    ).toBe(true);

    let name = uniqueId('matrix-key');
    await expectAuthMatrix(
      clients,
      (client, name_) =>
        client.post(
          isDashboard(name_) ? dashboardPath('/api-keys') : '/organization/api-keys',
          {
            type: 'instance_access_token_secret',
            instance_id: org.ids.instanceId,
            name
          }
        ),
      { none: 401, instance: 403, otherSession: [403, 404] }
    );
    let listed = await listAll(org.clients.management, '/organization/api-keys', {
      query: instanceKeysQuery()
    });
    expect(listed.map(item => item.name)).not.toContain(name);
  });

  it('returns the secret only on create and reveal', async () => {
    let created = await createKey({ description: 'REST key' });
    expectPresented(created, 'machine_access.api_key');
    expect(created).toMatchObject({
      status: 'active',
      type: 'instance_access_token_secret',
      description: 'REST key',
      ip_filters: []
    });
    expect(created.secret).toEqual(expect.any(String));
    expect(created.secret_redacted).not.toBe(created.secret);
    expect(created.machine_access.instance.id).toBe(org.ids.instanceId);

    let fetched = expectOk(
      await org.clients.management.get(`/organization/api-keys/${created.id}`)
    );
    expectPresented(fetched, 'machine_access.api_key');
    expect(fetched.secret).toBeNull();
    expect(fetched.secret_redacted).toBe(created.secret_redacted);

    let listed = await listAll(org.clients.management, '/organization/api-keys', {
      query: instanceKeysQuery()
    });
    expect(listed.map(item => item.id)).toContain(created.id);
    expect(listed.every(item => item.secret === null)).toBe(true);

    let revealed = expectOk(
      await org.clients.management.post(`/organization/api-keys/${created.id}/reveal`)
    );
    expect(revealed.secret).toBe(created.secret);

    let instance = expectOk(await instanceApi(created.secret).get('/instance'));
    expect(instance.id).toBe(org.ids.instanceId);
  });

  it('stops revealing production secrets after the reveal window', async () => {
    let created = await createKey();

    await db.apiKey.update({
      where: { id: created.id },
      data: { canRevealUntil: new Date(Date.now() - 1_000) }
    });

    expectError(
      await org.clients.management.post(`/organization/api-keys/${created.id}/reveal`),
      403,
      'forbidden'
    );
    expectError(
      await org.clients.rest.post(dashboardPath(`/api-keys/${created.id}/reveal`)),
      403,
      'forbidden'
    );

    let fetched = expectOk(
      await org.clients.rest.get(dashboardPath(`/api-keys/${created.id}`))
    );
    expect(fetched.secret).toBeNull();
    expect(fetched.reveal_info.forever).toBe(false);
    expect(new Date(fetched.reveal_info.until).getTime()).toBeLessThan(Date.now());
  });

  it('shows the reveal window to dashboard sessions only', async () => {
    let secretKey = await createKey({}, org.clients.rest);
    expectPresented(secretKey, 'machine_access.api_key');
    expect(secretKey.secret).toEqual(expect.any(String));
    expect(secretKey.reveal_info.forever).toBe(false);
    expect(new Date(secretKey.reveal_info.until).getTime()).toBeGreaterThan(Date.now());

    let publishable = await createKey(
      { type: 'instance_access_token_publishable' },
      org.clients.rest
    );
    expect(publishable.type).toBe('instance_access_token_publishable');
    expect(publishable.reveal_info).toEqual({ until: null, forever: true });

    let viaManagement = expectOk(
      await org.clients.management.get(`/organization/api-keys/${secretKey.id}`)
    );
    expect(viaManagement.reveal_info).toBeNull();
  });

  it('rejects organization management tokens over REST', async () => {
    let name = uniqueId('mgmt-over-rest');

    for (let client of [org.clients.management, org.clients.rest]) {
      let path =
        client === org.clients.rest ? dashboardPath('/api-keys') : '/organization/api-keys';

      expectError(
        await client.post(path, { type: 'organization_management_token', name }),
        400,
        'invalid_data'
      );
      expectError(
        await client.post(path, {
          type: 'organization_management_token',
          instance_id: org.ids.instanceId,
          name
        }),
        400,
        'invalid_data'
      );
    }

    let managementKeys = await listAll(org.clients.management, '/organization/api-keys', {
      query: { type: 'organization_management_token' }
    });
    expect(managementKeys.map(item => item.name)).not.toContain(name);
  });

  it('validates api key bodies and queries', async () => {
    let create = (body: Record<string, unknown>) =>
      org.clients.management.post('/organization/api-keys', {
        type: 'instance_access_token_secret',
        instance_id: org.ids.instanceId,
        name: uniqueId('invalid-key'),
        ...body
      });

    expectError(await create({ type: 'instance_access_token_magic' }), 400, 'invalid_data');
    expectError(await create({ name: undefined }), 400, 'invalid_data');
    expectError(await create({ instance_id: undefined }), 400, 'invalid_data');
    expectError(await create({ expires_at: 'tomorrow-ish' }), 400, 'invalid_data');
    expectError(await create({ ip_filters: '10.0.0.1' }), 400, 'invalid_data');

    let invalidFilter = expectError(
      await create({ ip_filters: ['10.0.0.0/33'] }),
      400,
      'bad_request'
    );
    expect(invalidFilter.message).toContain('10.0.0.0/33');

    let list = (query: Record<string, string>) =>
      org.clients.management.get('/organization/api-keys', { query });

    expectError(await list({}), 400, 'invalid_data');
    expectError(await list({ type: 'everything' }), 400, 'invalid_data');
    expectError(await list({ type: 'instance_access_token' }), 400, 'invalid_data');
  });

  it('updates, rotates and revokes keys', async () => {
    let created = await createKey();
    let keyPath = `/organization/api-keys/${created.id}`;
    expectOk(await instanceApi(created.secret).get('/instance'));

    let name = uniqueId('renamed-key');
    let updated = expectOk(
      await org.clients.management.post(keyPath, {
        name,
        description: 'Updated over REST',
        ip_filters: ['0.0.0.0/0', '::/0']
      })
    );
    expectPresented(updated, 'machine_access.api_key');
    expect(updated).toMatchObject({
      name,
      description: 'Updated over REST',
      ip_filters: ['0.0.0.0/0', '::/0'],
      secret: null
    });
    expect(updated.machine_access.name).toBe(`INSTANCE TOKEN ${name}`);

    let rotated = expectOk(await org.clients.management.post(`${keyPath}/rotate`, {}));
    expect(rotated.secret).toEqual(expect.any(String));
    expect(rotated.secret).not.toBe(created.secret);
    expect(rotated.secret_redacted).not.toBe(created.secret_redacted);

    expectOk(await instanceApi(rotated.secret).get('/instance'));
    await eventually(async () => {
      expect((await instanceApi(created.secret).get('/instance')).status).toBe(401);
    });

    let revoked = expectOk(await org.clients.management.delete(keyPath));
    expect(revoked).toMatchObject({ status: 'deleted', secret: null });
    expect(revoked.deleted_at).toEqual(expect.any(String));

    await eventually(async () => {
      expect((await instanceApi(rotated.secret).get('/instance')).status).toBe(401);
    });

    expectError(await org.clients.management.delete(keyPath), 403, 'forbidden');
    expectError(await org.clients.management.post(keyPath, { name: 'x' }), 403, 'forbidden');
    expectError(await org.clients.management.post(`${keyPath}/rotate`, {}), 403, 'forbidden');
    expectError(await org.clients.management.post(`${keyPath}/reveal`), 403, 'forbidden');
    expect(expectOk(await org.clients.management.get(keyPath)).status).toBe('deleted');

    let listed = await listAll(org.clients.management, '/organization/api-keys', {
      query: instanceKeysQuery()
    });
    expect(listed.map(item => item.id)).not.toContain(created.id);
  });

  it('pages through instance keys without gaps or duplicates', async () => {
    let created = [
      await createKey({ type: 'instance_access_token_publishable' }),
      await createKey({ type: 'instance_access_token_publishable' }),
      await createKey()
    ];

    let listed = await listAll(org.clients.management, '/organization/api-keys', {
      query: instanceKeysQuery(),
      limit: 1
    });
    let ids = listed.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(created.map(key => key.id)));
    expect(listed.every(item => item.machine_access.instance.id === org.ids.instanceId)).toBe(
      true
    );

    expectError(
      await org.clients.management.get('/organization/api-keys', {
        query: { ...instanceKeysQuery(), limit: 0 }
      }),
      400,
      'invalid_data'
    );
  });

  it('hides api keys and instances of other organizations', async () => {
    let created = await createKey();
    let other = otherOrg.clients.management;
    let keyPath = `/organization/api-keys/${created.id}`;

    expectError(await other.get(keyPath), 404, 'not_found');
    expectError(await other.post(keyPath, { name: 'hijacked' }), 404, 'not_found');
    expectError(await other.post(`${keyPath}/reveal`), 404, 'not_found');
    expectError(await other.post(`${keyPath}/rotate`, {}), 404, 'not_found');
    expectError(await other.delete(keyPath), 404, 'not_found');

    expectError(
      await other.post('/organization/api-keys', {
        type: 'instance_access_token_secret',
        instance_id: org.ids.instanceId,
        name: uniqueId('foreign')
      }),
      404,
      'not_found'
    );
    expectError(
      await other.get('/organization/api-keys', { query: instanceKeysQuery() }),
      404,
      'not_found'
    );

    let otherSession = rest(metorialEndpoints().api, { session: otherOrg.session });
    let foreign = await otherSession.get(dashboardPath(`/api-keys/${created.id}`));
    expect([403, 404]).toContain(foreign.status);

    let stillThere = expectOk(await org.clients.management.get(keyPath));
    expect(stillThere).toMatchObject({ status: 'active', name: created.name });
  });
});
