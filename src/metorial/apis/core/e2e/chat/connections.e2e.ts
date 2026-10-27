import {
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMcpTestServer,
  useMember,
  useOrganization,
  type RemoteProvider,
  type RestClient
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createChatProviders,
  createChatSetup,
  createConnection,
  createPublishableClient,
  ownResourceStatuses,
  providerSetupTimeout,
  readStatuses,
  routeFor,
  tenantClients,
  workerTimeout,
  writeDenials,
  type ChatSetup
} from './_shared';

describe('api-core chat connections and instances', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);
  let server = useMcpTestServer();
  let providers = createChatProviders(org, server);

  let publishable: RestClient;
  let capable: RemoteProvider;
  let plain: RemoteProvider;
  let setup: ChatSetup;

  beforeAll(async () => {
    publishable = await createPublishableClient(org);
    capable = await providers.capable();
    plain = await providers.plain();
    setup = await createChatSetup(org.clients.instance, capable.providerId);
  }, providerSetupTimeout);

  let clients = () =>
    tenantClients(org, otherOrg, { member: member.clients.rest, publishable });

  let eventTypes = async (query: Record<string, string>) =>
    (await listAll(org.clients.instance, '/chat/events', { query })).map(event => event.type);

  it('applies the auth matrix to connection routes', async () => {
    let connectionPath = `/chat/connections/${setup.connection.id}`;

    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, '/chat/connections')),
      readStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.get(routeFor(org, name, connectionPath)),
      ownResourceStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.post(routeFor(org, name, '/chat/connections'), {
          name: uniqueId(`by-${name}`),
          provider: { provider_id: capable.providerId }
        }),
      readStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.patch(routeFor(org, name, connectionPath), {
          description: `edited by ${name}`
        }),
      ownResourceStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.delete(routeFor(org, name, connectionPath)),
      writeDenials
    );
  });

  it('applies the auth matrix to instance and event routes', async () => {
    let instancePath = `/chat/instances/${setup.instance.id}`;

    for (let path of ['/chat/instances', '/chat/events']) {
      await expectAuthMatrix(
        clients(),
        (client, name) => client.get(routeFor(org, name, path)),
        readStatuses
      );
    }
    for (let path of [instancePath, `${instancePath}/provider`]) {
      await expectAuthMatrix(
        clients(),
        (client, name) => client.get(routeFor(org, name, path)),
        ownResourceStatuses
      );
    }

    await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.post(routeFor(org, name, '/chat/instances'), {
          chat_connection_id: setup.connection.id,
          name: uniqueId(`by-${name}`)
        }),
      { ...readStatuses, otherInstance: 404 }
    );
    await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.patch(routeFor(org, name, instancePath), { description: `edited by ${name}` }),
      ownResourceStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.post(routeFor(org, name, `${instancePath}/sync`)),
      ownResourceStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) =>
        client.patch(routeFor(org, name, `${instancePath}/provider`), {
          provider_id: capable.providerId
        }),
      ownResourceStatuses
    );
    await expectAuthMatrix(
      clients(),
      (client, name) => client.delete(routeFor(org, name, instancePath)),
      writeDenials
    );
  });

  it('rejects invalid connection and instance bodies', async () => {
    let client = org.clients.instance;

    expectError(await client.post('/chat/connections', {}), 400, 'invalid_data');
    expectError(
      await client.post('/chat/connections', { name: 'missing provider id', provider: {} }),
      400,
      'invalid_data'
    );
    expectError(
      await client.patch(`/chat/connections/${setup.connection.id}`, { metadata: 'flat' }),
      400,
      'invalid_data'
    );
    expectError(
      await client.get('/chat/connections', { query: { status: 'paused' } }),
      400,
      'invalid_data'
    );

    expectError(await client.post('/chat/instances', {}), 400, 'invalid_data');
    expectError(
      await client.patch(`/chat/instances/${setup.instance.id}/provider`, {}),
      400,
      'invalid_data'
    );
    expectError(
      await client.get('/chat/instances', { query: { status: 'paused' } }),
      400,
      'invalid_data'
    );
    expectError(
      await client.get('/chat/events', { query: { 'created_at[gt]': 'yesterday' } }),
      400,
      'invalid_data'
    );
  });

  it('only links chat-capable providers to a connection', async () => {
    expectError(
      await org.clients.instance.post('/chat/connections', {
        name: uniqueId('plain'),
        provider: { provider_id: plain.providerId }
      }),
      400,
      'provider_does_not_implement_adapter'
    );

    let foreign = await otherOrg.clients.instance.post('/chat/connections', {
      name: uniqueId('foreign'),
      provider: { provider_id: capable.providerId }
    });
    expect(foreign.body?.object).toBe('error');
    expect([400, 404]).toContain(foreign.status);
  });

  it(
    'creates, updates and archives a connection without exposing private metadata',
    async () => {
      let created = await createConnection(org.clients.instance, capable.providerId, {
        description: 'Support Slack',
        metadata: { team: 'support' },
        private_metadata: { secret: 'never-presented' }
      });

      expectPresented(created, 'chat.connection');
      expect(created).toMatchObject({
        status: 'active',
        description: 'Support Slack',
        metadata: { team: 'support' }
      });
      expect(created.providers).toHaveLength(1);
      expect(created).not.toHaveProperty('private_metadata');
      expect(JSON.stringify(created)).not.toContain('never-presented');

      let fetched = expectOk(
        await org.clients.rest.get(routeFor(org, 'session', `/chat/connections/${created.id}`))
      );
      expectPresented(fetched, 'chat.connection');
      expect(fetched.id).toBe(created.id);
      expect(JSON.stringify(fetched)).not.toContain('never-presented');

      let updated = expectOk(
        await org.clients.instance.patch(`/chat/connections/${created.id}`, {
          name: 'Renamed connection',
          description: null,
          private_metadata: { secret: 'rotated-secret' }
        })
      );
      expect(updated).toMatchObject({ name: 'Renamed connection', description: null });
      expect(JSON.stringify(updated)).not.toContain('rotated-secret');

      let archived = expectOk(
        await org.clients.instance.delete(`/chat/connections/${created.id}`)
      );
      expect(archived).toMatchObject({ id: created.id, status: 'archived' });
      expect(
        expectOk(await org.clients.instance.get(`/chat/connections/${created.id}`)).status
      ).toBe('archived');

      let active = await listAll(org.clients.instance, '/chat/connections', {
        query: { id: created.id }
      });
      expect(active).toEqual([]);
      let withArchived = await listAll(org.clients.instance, '/chat/connections', {
        query: { id: created.id, status: 'archived' }
      });
      expect(withArchived.map(entry => entry.id)).toEqual([created.id]);

      expectError(
        await org.clients.instance.patch(`/chat/connections/${created.id}`, { name: 'late' }),
        410,
        'gone'
      );
      expectError(
        await org.clients.instance.delete(`/chat/connections/${created.id}`),
        410,
        'gone'
      );
      expectError(
        await org.clients.instance.post('/chat/instances', { chat_connection_id: created.id }),
        410,
        'gone'
      );

      await eventually(async () => {
        expect(await eventTypes({ chat_connection_id: created.id })).toEqual(
          expect.arrayContaining([
            'chat.connection.created',
            'chat.connection.updated',
            'chat.connection.archived'
          ])
        );
      }, workerTimeout);
    },
    providerSetupTimeout
  );

  it('presents connection events with a payload only on the single-event route', async () => {
    let connection = await createConnection(org.clients.instance, capable.providerId);

    let [listed] = await eventually(async () => {
      let events = await listAll(org.clients.instance, '/chat/events', {
        query: { chat_connection_id: connection.id, type: 'chat.connection.created' }
      });
      expect(events).toHaveLength(1);
      return events;
    }, workerTimeout);

    expectPresented(listed, 'chat.event');
    expect(listed).toMatchObject({ chat_connection_id: connection.id, chat_id: null });
    expect(listed).not.toHaveProperty('payload');

    let single = expectOk(await org.clients.instance.get(`/chat/events/${listed.id}`));
    expectPresented(single, 'chat.event');
    expect(single).toHaveProperty('payload');
    expect(single).not.toHaveProperty('error');

    let dashboard = expectOk(
      await org.clients.rest.get(routeFor(org, 'session', `/chat/events/${listed.id}`))
    );
    expect(dashboard).toHaveProperty('error');

    expectError(await otherOrg.clients.instance.get(`/chat/events/${listed.id}`), 404);
    expect(
      await listAll(otherOrg.clients.instance, '/chat/events', {
        query: { chat_connection_id: connection.id }
      })
    ).toEqual([]);
    expectError(await org.clients.instance.get('/chat/events/cev_missing'), 404);
  });

  it('pages through connections and instances without duplicates', async () => {
    let connections = [
      await createConnection(org.clients.instance, capable.providerId),
      await createConnection(org.clients.instance, capable.providerId),
      await createConnection(org.clients.instance, capable.providerId)
    ];
    let idQuery = Object.fromEntries(
      connections.map((entry, index) => [`id[${index}]`, entry.id])
    );

    let paged = await listAll(org.clients.instance, '/chat/connections', {
      query: idQuery,
      limit: 1
    });
    expect(paged.map(entry => entry.id).sort()).toEqual(
      connections.map(entry => entry.id).sort()
    );

    let instances = [];
    for (let index = 0; index < 3; index++) {
      instances.push(
        expectOk(
          await org.clients.instance.post('/chat/instances', {
            chat_connection_id: connections[0]!.id,
            name: uniqueId('paged')
          })
        )
      );
    }
    let instancePage = await listAll(org.clients.instance, '/chat/instances', {
      query: { chat_connection_id: connections[0]!.id },
      limit: 1
    });
    expect(instancePage.map(entry => entry.id).sort()).toEqual(
      instances.map(entry => entry.id).sort()
    );
    instancePage.forEach(entry => expectPresented(entry, 'chat.instance'));
  });

  it(
    'runs an instance from draft through its provider to archived',
    async () => {
      let connection = await createConnection(org.clients.instance, capable.providerId);

      let created = expectOk(
        await org.clients.instance.post('/chat/instances', {
          chat_connection_id: connection.id,
          name: 'Support bot',
          metadata: { env: 'e2e' },
          private_metadata: { token: 'instance-secret' }
        })
      );
      expectPresented(created, 'chat.instance');
      expect(created).toMatchObject({
        status: 'draft',
        chat_connection_id: connection.id,
        name: 'Support bot',
        metadata: { env: 'e2e' }
      });
      expect(JSON.stringify(created)).not.toContain('instance-secret');

      let path = `/chat/instances/${created.id}`;
      expectError(await org.clients.instance.get(`${path}/provider`), 404, 'not_found');
      expectError(
        await org.clients.instance.patch(`${path}/provider`, {
          provider_id: plain.providerId
        }),
        400,
        'provider_does_not_implement_adapter'
      );
      expectError(
        await org.clients.instance.patch(`${path}/provider`, { provider_id: 'pro_missing' }),
        400,
        'provider_not_found'
      );

      let provider = expectOk(
        await org.clients.instance.patch(`${path}/provider`, {
          provider_id: capable.providerId
        })
      );
      expectPresented(provider, 'chat.instance_provider');
      expect(provider).toMatchObject({ chat_instance_id: created.id, status: 'active' });
      expect(provider.provider.id).toBe(capable.providerId);

      let fetchedProvider = expectOk(await org.clients.instance.get(`${path}/provider`));
      expect(fetchedProvider.id).toBe(provider.id);

      await eventually(async () => {
        expect(expectOk(await org.clients.instance.get(path)).status).toBe('active');
      }, workerTimeout);

      expectError(
        await org.clients.instance.get(`${path}/provider/authenticated-user`),
        400,
        'chat_user_self_read_not_supported'
      );
      expect(expectOk(await org.clients.instance.post(`${path}/sync`)).id).toBe(created.id);

      let updated = expectOk(
        await org.clients.instance.patch(path, { name: 'Renamed bot', description: null })
      );
      expect(updated).toMatchObject({ name: 'Renamed bot', description: null });

      let archived = expectOk(await org.clients.instance.delete(path));
      expect(archived).toMatchObject({ id: created.id, status: 'archived' });
      expect(expectOk(await org.clients.instance.get(path)).status).toBe('archived');
      expectError(await org.clients.instance.patch(path, { name: 'late' }), 410, 'gone');
      expectError(await org.clients.instance.delete(path), 410, 'gone');

      let archivedList = await listAll(org.clients.instance, '/chat/instances', {
        query: { id: created.id, status: 'archived' }
      });
      expect(archivedList.map(entry => entry.id)).toEqual([created.id]);
    },
    providerSetupTimeout
  );

  it('keeps connections and instances private to their organization', async () => {
    let foreign = otherOrg.clients.instance;
    let connectionPath = `/chat/connections/${setup.connection.id}`;
    let instancePath = `/chat/instances/${setup.instance.id}`;

    expectError(await foreign.get(connectionPath), 404);
    expectError(await foreign.patch(connectionPath, { name: 'stolen' }), 404);
    expectError(await foreign.delete(connectionPath), 404);
    expectError(
      await foreign.post('/chat/instances', { chat_connection_id: setup.connection.id }),
      404
    );

    expectError(await foreign.get(instancePath), 404);
    expectError(await foreign.get(`${instancePath}/provider`), 404);
    expectError(
      await foreign.patch(`${instancePath}/provider`, { provider_id: capable.providerId }),
      404
    );
    expectError(await foreign.post(`${instancePath}/sync`), 404);

    let foreignConnections = await listAll(foreign, '/chat/connections', {
      query: { id: setup.connection.id }
    });
    expect(foreignConnections).toEqual([]);
    let foreignInstances = await listAll(foreign, '/chat/instances', {
      query: { chat_connection_id: setup.connection.id }
    });
    expect(foreignInstances).toEqual([]);

    expect(expectOk(await org.clients.instance.get(connectionPath)).id).toBe(
      setup.connection.id
    );
  });
});
