import {
  API_VERSIONS,
  createRemoteProvider,
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  crossTenantClients,
  discoverProviderTools,
  ids,
  instancePathFor,
  providerToolKeys
} from './_shared';

describe('api-core sessions: magic MCP', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let providerId: string;

  beforeAll(async () => {
    ({ providerId } = await createRemoteProvider(org.clients.instance, { url: server.url }));
    await discoverProviderTools(org, providerId);
  }, 180_000);

  let api = () => org.clients.instance;
  let other = () => otherOrg.clients.instance;

  let createServer = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await api().post('/magic-mcp-servers', { name: uniqueId('Magic Server'), ...body })
    );

  let createEndpoint = async (serverIds: string[], body: Record<string, unknown> = {}) =>
    expectOk(
      await api().post('/magic-mcp-endpoints', {
        name: uniqueId('Magic Endpoint'),
        magic_mcp_servers: serverIds.map(id => ({ magic_mcp_server_id: id })),
        ...body
      })
    );

  let createToken = async (body: Record<string, unknown> = {}) =>
    expectOk(
      await api().post('/magic-mcp-tokens', { name: uniqueId('Magic Token'), ...body })
    );

  describe('servers', () => {
    it('authenticates magic MCP server routes per credential', async () => {
      let magicServer = await createServer();

      await expectAuthMatrix(
        crossTenantClients(org, otherOrg),
        (client, name) =>
          client.get(instancePathFor(org, name, `/magic-mcp-servers/${magicServer.id}`)),
        {
          none: 401,
          session: 200,
          management: 200,
          instance: 200,
          otherSession: 404,
          otherManagement: 404,
          otherInstance: 404
        }
      );
    });

    it('runs the magic MCP server lifecycle', async () => {
      let name = uniqueId('Magic Server');
      let created = await createServer({
        name,
        description: 'Created by e2e',
        metadata: { env: 'e2e' }
      });
      expectPresented(created, 'magic_mcp.server');
      expect(created).toMatchObject({
        status: 'active',
        name,
        description: 'Created by e2e',
        metadata: { env: 'e2e' },
        source: 'manual',
        provider_template_id: null,
        providers: []
      });

      let fetched = expectOk(await api().get(`/magic-mcp-servers/${created.id}`));
      expect(fetched.id).toBe(created.id);

      let updated = expectOk(
        await api().patch(`/magic-mcp-servers/${created.id}`, {
          name: 'Renamed magic server',
          metadata: { env: 'renamed' }
        })
      );
      expect(updated).toMatchObject({
        name: 'Renamed magic server',
        metadata: { env: 'renamed' }
      });

      let listed = await listAll(api(), '/magic-mcp-servers', { query: { id: created.id } });
      expect(ids(listed)).toEqual([created.id]);

      let archived = expectOk(await api().delete(`/magic-mcp-servers/${created.id}`));
      expect(archived.status).toBe('archived');

      expectError(
        await api().delete(`/magic-mcp-servers/${created.id}`),
        412,
        'precondition_failed'
      );
      expectError(
        await api().patch(`/magic-mcp-servers/${created.id}`, { name: 'Too late' }),
        412,
        'precondition_failed'
      );

      let active = await listAll(api(), '/magic-mcp-servers');
      expect(ids(active)).not.toContain(created.id);
    });

    it('attaches providers to a server and exposes their tools', async () => {
      let magicServer = await createServer();

      let attached = expectOk(
        await api().post(`/magic-mcp-servers/${magicServer.id}/providers`, {
          provider_id: providerId
        })
      );
      expectPresented(attached, 'magic_mcp.server.provider');
      expect(attached).toMatchObject({
        magic_mcp_server_id: magicServer.id,
        provider_management_mode: 'manual',
        provider: { id: providerId }
      });

      let providers = await listAll(api(), `/magic-mcp-servers/${magicServer.id}/providers`, {
        query: { status: 'active' }
      });
      expect(ids(providers)).toEqual([attached.id]);

      let fetched = expectOk(
        await api().get(`/magic-mcp-servers/${magicServer.id}/providers/${attached.id}`)
      );
      expect(fetched.id).toBe(attached.id);

      await eventually(
        async () => {
          let tools = expectOk(await api().get(`/magic-mcp-servers/${magicServer.id}/tools`));
          expect(tools.object).toBe('provider.tools');
          expect(tools.items.map((item: any) => item.key)).toEqual(
            expect.arrayContaining(providerToolKeys)
          );
        },
        { timeoutMs: 45_000, intervalMs: 1_000 }
      );

      let updated = expectOk(
        await api().patch(`/magic-mcp-servers/${magicServer.id}/providers/${attached.id}`, {
          tool_filters: { type: 'tool_keys', keys: ['echo'] }
        })
      );
      expect(JSON.stringify(updated.tool_filter)).toContain('echo');

      let removed = expectOk(
        await api().delete(`/magic-mcp-servers/${magicServer.id}/providers/${attached.id}`)
      );
      expect(removed.status).not.toBe('active');

      let remaining = await listAll(api(), `/magic-mcp-servers/${magicServer.id}/providers`, {
        query: { status: 'active' }
      });
      expect(remaining).toEqual([]);
    }, 90_000);

    it('resolves the linked session of a server on the dashboard API only', async () => {
      let magicServer = await createServer();
      expectOk(
        await api().post(`/magic-mcp-servers/${magicServer.id}/providers`, {
          provider_id: providerId
        })
      );

      let linked = expectOk(
        await org.clients.rest.post(
          `/dashboard/instances/${org.ids.instanceId}/magic-mcp-servers/${magicServer.id}/session`
        )
      );
      expectPresented(linked, 'session');
      expect(linked.providers.map((item: any) => item.provider_id)).toContain(providerId);

      let again = expectOk(
        await api()
          .with({ version: API_VERSIONS.dashboard })
          .post(`/magic-mcp-servers/${magicServer.id}/session`)
      );
      expect(again.id).toBe(linked.id);

      expectError(await api().post(`/magic-mcp-servers/${magicServer.id}/session`), 404);

      expectError(
        await api().patch(`/sessions/${linked.id}`, { name: 'Not allowed' }),
        400,
        'session_is_metorial_managed'
      );
      expectError(
        await api().delete(`/sessions/${linked.id}`),
        400,
        'session_is_metorial_managed'
      );
    });

    it('validates magic MCP server bodies', async () => {
      for (let body of [{ name: 42 }, { metadata: 'x' }, { provider_template_id: 42 }]) {
        expectError(await api().post('/magic-mcp-servers', body), 400, 'invalid_data');
      }
      expectError(
        await api().post('/magic-mcp-servers', {
          provider_template_id: uniqueId('ptpl'),
          integration_instance_id: uniqueId('ii')
        }),
        400,
        'magic_mcp_server_backing_conflict'
      );

      let magicServer = await createServer();
      expectError(
        await api().patch(`/magic-mcp-servers/${magicServer.id}`, { aliases: 'x' }),
        400,
        'invalid_data'
      );
      for (let body of [{}, { provider_id: 42 }, { provider_id: 'x', tool_filters: 'x' }]) {
        expectError(
          await api().post(`/magic-mcp-servers/${magicServer.id}/providers`, body),
          400,
          'invalid_data'
        );
      }
      expectError(
        await api().get('/magic-mcp-servers', { query: { owner: 'nobody' } }),
        400,
        'invalid_data'
      );
      expectError(await api().get(`/magic-mcp-servers/${uniqueId('mms')}`), 404, 'not_found');
    });

    it('pages through magic MCP servers', async () => {
      let created = [await createServer(), await createServer(), await createServer()];

      let paged = await listAll(api(), '/magic-mcp-servers', { limit: 1 });
      expect(new Set(ids(paged)).size).toBe(paged.length);
      expect(ids(paged)).toEqual(expect.arrayContaining(ids(created)));
    });

    it('hides magic MCP servers from other organizations', async () => {
      let magicServer = await createServer();

      for (let response of [
        await other().get(`/magic-mcp-servers/${magicServer.id}`),
        await other().patch(`/magic-mcp-servers/${magicServer.id}`, { name: 'x' }),
        await other().delete(`/magic-mcp-servers/${magicServer.id}`),
        await other().get(`/magic-mcp-servers/${magicServer.id}/tools`),
        await other().get(`/magic-mcp-servers/${magicServer.id}/providers`),
        await other().post(`/magic-mcp-servers/${magicServer.id}/providers`, {
          provider_id: providerId
        })
      ]) {
        expectError(response, 404, 'not_found');
      }

      expect(ids(await listAll(other(), '/magic-mcp-servers'))).not.toContain(magicServer.id);

      let otherServer = expectOk(
        await other().post('/magic-mcp-servers', { name: uniqueId('Other Server') })
      );
      let foreignProvider = expectError(
        await other().post(`/magic-mcp-servers/${otherServer.id}/providers`, {
          provider_id: providerId
        }),
        404,
        'not_found'
      );
      expect(foreignProvider.entity).toBe('provider');
    });
  });

  describe('endpoints', () => {
    it('runs the magic MCP endpoint lifecycle', async () => {
      let first = await createServer();
      let second = await createServer();

      let endpoint = await createEndpoint([first.id], { metadata: { env: 'e2e' } });
      expectPresented(endpoint, 'magic_mcp.endpoint');
      expect(endpoint.status).toBe('active');
      expect(endpoint.url).toContain(`/connect/magic/${endpoint.slug}`);
      expect(ids(endpoint.servers)).toEqual([first.id]);

      let added = expectOk(
        await api().post(`/magic-mcp-endpoints/${endpoint.id}/add-servers`, {
          magic_mcp_servers: [
            {
              magic_mcp_server_id: second.id,
              tool_filters: { type: 'tool_keys', keys: ['add'] }
            }
          ]
        })
      );
      expect(ids(added.servers).sort()).toEqual([first.id, second.id].sort());

      let byServer = await listAll(api(), '/magic-mcp-endpoints', {
        query: { magic_mcp_server_id: second.id }
      });
      expect(ids(byServer)).toEqual([endpoint.id]);

      let removed = expectOk(
        await api().post(`/magic-mcp-endpoints/${endpoint.id}/remove-servers`, {
          magic_mcp_server_ids: [first.id]
        })
      );
      expect(ids(removed.servers)).toEqual([second.id]);

      let updated = expectOk(
        await api().patch(`/magic-mcp-endpoints/${endpoint.id}`, { name: 'Renamed endpoint' })
      );
      expect(updated.name).toBe('Renamed endpoint');

      let fetched = expectOk(await api().get(`/magic-mcp-endpoints/${endpoint.id}`));
      expect(fetched.name).toBe('Renamed endpoint');

      let archived = expectOk(await api().delete(`/magic-mcp-endpoints/${endpoint.id}`));
      expect(archived.status).toBe('archived');

      let active = await listAll(api(), '/magic-mcp-endpoints');
      expect(ids(active)).not.toContain(endpoint.id);
    });

    it('validates magic MCP endpoint bodies', async () => {
      let magicServer = await createServer();
      for (let body of [
        { name: 42 },
        { magic_mcp_servers: [{}] },
        { magic_mcp_servers: [{ magic_mcp_server_id: magicServer.id, tool_filters: 'x' }] },
        { magic_mcp_servers: 'x' }
      ]) {
        expectError(await api().post('/magic-mcp-endpoints', body), 400, 'invalid_data');
      }

      let endpoint = await createEndpoint([magicServer.id]);
      expectError(
        await api().post(`/magic-mcp-endpoints/${endpoint.id}/add-servers`, {}),
        400,
        'bad_request'
      );
      expectError(
        await api().post(`/magic-mcp-endpoints/${endpoint.id}/remove-servers`, {}),
        400,
        'invalid_data'
      );
      expectError(
        await api().get('/magic-mcp-endpoints', { query: { status: 'unknown' } }),
        400,
        'invalid_data'
      );
    });

    it('hides magic MCP endpoints from other organizations', async () => {
      let magicServer = await createServer();
      let endpoint = await createEndpoint([magicServer.id]);

      for (let response of [
        await other().get(`/magic-mcp-endpoints/${endpoint.id}`),
        await other().patch(`/magic-mcp-endpoints/${endpoint.id}`, { name: 'x' }),
        await other().delete(`/magic-mcp-endpoints/${endpoint.id}`),
        await other().post(`/magic-mcp-endpoints/${endpoint.id}/remove-servers`, {
          magic_mcp_server_ids: [magicServer.id]
        })
      ]) {
        expectError(response, 404, 'not_found');
      }
    });

    it('rejects endpoints that reference unknown or foreign servers', async () => {
      let magicServer = await createServer();
      for (let magicMcpServerId of [uniqueId('mms'), magicServer.id]) {
        expectError(
          await other().post('/magic-mcp-endpoints', {
            name: 'Foreign servers',
            magic_mcp_servers: [{ magic_mcp_server_id: magicMcpServerId }]
          }),
          404,
          'not_found'
        );
      }
    });
  });

  describe('tokens and groups', () => {
    it('runs the magic MCP token lifecycle and always returns the secret', async () => {
      let magicServer = await createServer();

      let token = await createToken({
        magic_mcp_server_id: magicServer.id,
        metadata: { env: 'e2e' }
      });
      expectPresented(token, 'magic_mcp.token');
      expect(token).toMatchObject({
        status: 'active',
        metadata: { env: 'e2e' },
        server: { id: magicServer.id },
        endpoint: null,
        groups: []
      });
      expect(token.secret).toEqual(expect.any(String));

      let fetched = expectOk(await api().get(`/magic-mcp-tokens/${token.id}`));
      expect(fetched.secret).toBe(token.secret);

      let listed = await listAll(api(), '/magic-mcp-tokens', {
        query: { magic_mcp_server_id: magicServer.id }
      });
      expect(ids(listed)).toEqual([token.id]);

      let updated = expectOk(
        await api().patch(`/magic-mcp-tokens/${token.id}`, {
          name: 'Renamed token',
          description: 'Updated by e2e'
        })
      );
      expect(updated).toMatchObject({ name: 'Renamed token', description: 'Updated by e2e' });

      let deleted = expectOk(await api().delete(`/magic-mcp-tokens/${token.id}`));
      expect(deleted.status).toBe('deleted');
      expectError(
        await api().delete(`/magic-mcp-tokens/${token.id}`),
        412,
        'precondition_failed'
      );

      let all = await listAll(api(), '/magic-mcp-tokens', {
        query: { magic_mcp_server_id: magicServer.id }
      });
      expect(all.map((item: any) => [item.id, item.status])).toEqual([[token.id, 'deleted']]);

      let active = await listAll(api(), '/magic-mcp-tokens', {
        query: { magic_mcp_server_id: magicServer.id, status: 'active' }
      });
      expect(active).toEqual([]);
    });

    it('validates magic MCP token bodies', async () => {
      let magicServer = await createServer();
      let endpoint = await createEndpoint([magicServer.id]);

      for (let body of [
        {},
        { name: 42 },
        { name: 'x', magic_mcp_group_ids: 'x' },
        { name: 'x', metadata: 'x' }
      ]) {
        expectError(await api().post('/magic-mcp-tokens', body), 400, 'invalid_data');
      }

      expectError(
        await api().post('/magic-mcp-tokens', {
          name: 'Both targets',
          magic_mcp_server_id: magicServer.id,
          magic_mcp_endpoint_id: endpoint.id
        }),
        400,
        'bad_request'
      );
      expectError(
        await api().post('/magic-mcp-tokens', {
          name: 'Missing server',
          magic_mcp_server_id: uniqueId('mms')
        }),
        404,
        'not_found'
      );
      expectError(
        await api().get('/magic-mcp-tokens', { query: { status: 'archived' } }),
        400,
        'invalid_data'
      );
    });

    it('runs the magic MCP group lifecycle and binds groups to tokens', async () => {
      let magicServer = await createServer();

      let group = expectOk(
        await api().post('/magic-mcp-groups', {
          name: uniqueId('Magic Group'),
          metadata: { env: 'e2e' }
        })
      );
      expectPresented(group, 'magic_mcp.group');
      expect(group).toMatchObject({ status: 'active', metadata: { env: 'e2e' } });

      expectOk(
        await api().post(`/magic-mcp-groups/${group.id}/add-servers`, {
          magic_mcp_server_ids: [magicServer.id]
        })
      );
      let filtered = await listAll(api(), '/magic-mcp-servers', {
        query: { magic_mcp_group_id: group.id }
      });
      expect(ids(filtered)).toEqual([magicServer.id]);

      let token = await createToken({ magic_mcp_group_ids: [group.id] });
      expect(ids(token.groups)).toEqual([group.id]);

      let other = await createToken();
      let withGroup = expectOk(
        await api().post(`/magic-mcp-tokens/${other.id}/add-groups`, {
          magic_mcp_group_ids: [group.id]
        })
      );
      expect(ids(withGroup.groups)).toEqual([group.id]);
      let withoutGroup = expectOk(
        await api().post(`/magic-mcp-tokens/${other.id}/remove-groups`, {
          magic_mcp_group_ids: [group.id]
        })
      );
      expect(withoutGroup.groups).toEqual([]);

      let renamed = expectOk(
        await api().patch(`/magic-mcp-groups/${group.id}`, { name: 'Renamed group' })
      );
      expect(renamed.name).toBe('Renamed group');

      expectOk(
        await api().post(`/magic-mcp-groups/${group.id}/remove-servers`, {
          magic_mcp_server_ids: [magicServer.id]
        })
      );
      expect(
        await listAll(api(), '/magic-mcp-servers', { query: { magic_mcp_group_id: group.id } })
      ).toEqual([]);

      expectError(
        await api().delete(`/magic-mcp-groups/${group.id}`),
        412,
        'precondition_failed'
      );
      expectOk(await api().delete(`/magic-mcp-tokens/${token.id}`));

      let deleted = expectOk(await api().delete(`/magic-mcp-groups/${group.id}`));
      expect(deleted.status).toBe('deleted');
      expectError(
        await api().patch(`/magic-mcp-groups/${group.id}`, { name: 'Too late' }),
        410,
        'gone'
      );

      let groups = await listAll(api(), '/magic-mcp-groups');
      expect(ids(groups)).not.toContain(group.id);

      for (let body of [{}, { name: 42 }]) {
        expectError(await api().post('/magic-mcp-groups', body), 400, 'invalid_data');
      }
    });

    it('lists magic MCP sessions', async () => {
      let sessions = expectOk(await api().get('/magic-mcp-sessions'));
      expect(Array.isArray(sessions.items)).toBe(true);
      expectError(
        await api().get(`/magic-mcp-sessions/${uniqueId('mmse')}`),
        404,
        'not_found'
      );
    });

    it('hides magic MCP tokens and groups from other organizations', async () => {
      let magicServer = await createServer();
      let token = await createToken({ magic_mcp_server_id: magicServer.id });
      let group = expectOk(
        await api().post('/magic-mcp-groups', { name: uniqueId('Magic Group') })
      );

      for (let response of [
        await other().get(`/magic-mcp-tokens/${token.id}`),
        await other().patch(`/magic-mcp-tokens/${token.id}`, { name: 'x' }),
        await other().delete(`/magic-mcp-tokens/${token.id}`),
        await other().get(`/magic-mcp-groups/${group.id}`),
        await other().delete(`/magic-mcp-groups/${group.id}`),
        await other().post('/magic-mcp-tokens', {
          name: 'Foreign server',
          magic_mcp_server_id: magicServer.id
        })
      ]) {
        expectError(response, 404, 'not_found');
      }

      let tokens = await listAll(other(), '/magic-mcp-tokens');
      expect(ids(tokens)).not.toContain(token.id);
      expect(JSON.stringify(tokens)).not.toContain(token.secret);
    });
  });
});
