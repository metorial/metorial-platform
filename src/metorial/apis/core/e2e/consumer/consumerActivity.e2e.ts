import {
  API_VERSIONS,
  connectSession,
  createProviderSession,
  createRemoteProvider,
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  findTool,
  listAll,
  metorialEndpoints,
  rest,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { beforeAll, describe, expect, it } from 'vitest';
import { ids, instancePathFor, loadPortalSurface, useConsumerPortal } from './_shared';

describe('api-core consumer: activity and OAuth authorizations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let consumerPortal = useConsumerPortal(org);
  let otherConsumerPortal = useConsumerPortal(otherOrg);

  let instanceTraffic: { connectionIds: string[]; toolCallIds: string[]; agentIds: string[] };

  beforeAll(async () => {
    let { providerId } = await createRemoteProvider(org.clients.instance, { url: server.url });
    let session = await createProviderSession(org.clients.instance, [providerId], {
      name: uniqueId('e2e-consumer-activity')
    });

    let client = connectSession(session.id, org.keys.instanceSecret);
    let init = await client.initialize();
    if (init.status !== 200) throw new Error(`initialize responded ${init.status}`);

    let tools = await client.listTools();
    let add = findTool(tools.result.tools, 'add');
    await client.request('tools/call', { name: add.name, arguments: { a: 2, b: 3 } });

    instanceTraffic = await eventually(
      async () => {
        let connections = await listAll(org.clients.instance, '/session-connections', {
          query: { session_id: session.id }
        });
        let toolCalls = await listAll(org.clients.instance, '/tool-calls');
        expect(connections.length).toBeGreaterThan(0);
        expect(toolCalls.length).toBeGreaterThan(0);

        return {
          connectionIds: ids(connections),
          toolCallIds: ids(toolCalls),
          agentIds: ids(await listAll(org.clients.instance, '/agents'))
        };
      },
      { timeoutMs: 60_000 }
    );
  }, 180_000);

  let activityRoutes = [
    '/consumer/agents',
    '/consumer/session-connections',
    '/consumer/tool-calls',
    '/consumer/identity-credentials',
    '/consumer/oauth/authorizations'
  ];

  it('serves activity only to consumer sessions', async () => {
    let { portal, consumer } = consumerPortal;
    let { publishableKey } = await loadPortalSurface(portal.id);
    let clients = {
      none: rest(metorialEndpoints().api),
      consumer: consumer.client,
      consumerMagnetar: consumer.magnetar,
      session: org.clients.rest,
      management: org.clients.management,
      instance: org.clients.instance,
      publishable: rest(metorialEndpoints().api, {
        apiKey: publishableKey,
        version: API_VERSIONS.magnetar
      })
    };

    for (let path of activityRoutes) {
      await expectAuthMatrix(
        clients,
        (client, name) => client.get(instancePathFor(org, name, path)),
        {
          none: 401,
          consumer: 200,
          consumerMagnetar: 200,
          session: 404,
          management: 404,
          instance: 401,
          publishable: 401
        }
      );
    }
  });

  it('hides instance traffic from consumers', async () => {
    let { consumer } = consumerPortal;

    for (let path of activityRoutes) {
      expect(await listAll(consumer.client, path)).toEqual([]);
    }

    let hidden: [string, string[]][] = [
      ['/consumer/session-connections', instanceTraffic.connectionIds],
      ['/consumer/tool-calls', instanceTraffic.toolCallIds],
      ['/consumer/agents', instanceTraffic.agentIds]
    ];
    for (let [path, resourceIds] of hidden) {
      for (let resourceId of resourceIds.slice(0, 3)) {
        expectError(await consumer.client.get(`${path}/${resourceId}`), 404, 'not_found');
      }
    }

    expectError(
      await consumer.client.get('/consumer/tool-calls', {
        query: { connection_id: instanceTraffic.connectionIds[0] }
      }),
      404,
      'not_found'
    );
  });

  it('keeps activity of one organization away from consumers of another', async () => {
    let otherConsumer = otherConsumerPortal.consumer.client;

    expect(await listAll(otherConsumer, '/consumer/session-connections')).toEqual([]);
    expectError(
      await otherConsumer.get(
        `/consumer/session-connections/${instanceTraffic.connectionIds[0]}`
      ),
      404,
      'not_found'
    );
    expectError(
      await otherConsumer.get(`/consumer/tool-calls/${instanceTraffic.toolCallIds[0]}`),
      404,
      'not_found'
    );
  });

  it('answers unknown activity and authorization ids with 404', async () => {
    let { consumer } = consumerPortal;

    for (let path of [
      `/consumer/agents/${uniqueId('agt')}`,
      `/consumer/session-connections/${uniqueId('sco')}`,
      `/consumer/tool-calls/${uniqueId('tcl')}`,
      `/consumer/identity-credentials/${uniqueId('idc')}`,
      `/consumer/oauth/authorizations/${uniqueId('oaa')}`
    ]) {
      expectError(await consumer.client.get(path), 404, 'not_found');
    }
    expectError(
      await consumer.client.post(`/consumer/oauth/authorizations/${uniqueId('oaa')}/revoke`),
      404,
      'not_found'
    );
  });

  it('validates activity and authorization queries', async () => {
    let { consumer } = consumerPortal;
    let invalid: [string, Record<string, string | number>][] = [
      ['/consumer/session-connections', { connection_state: 'unknown' }],
      ['/consumer/identity-credentials', { status: 'expired' }],
      ['/consumer/oauth/authorizations', { status: 'pending' }],
      ['/consumer/agents', { limit: 0 }],
      ['/consumer/tool-calls', { limit: 0 }]
    ];

    for (let [path, query] of invalid) {
      expectError(await consumer.client.get(path, { query }), 400, 'invalid_data');
    }

    expectOk(
      await consumer.client.get('/consumer/session-connections', {
        query: { connection_state: 'connected' }
      })
    );
    expectOk(
      await consumer.client.get('/consumer/oauth/authorizations', {
        query: { status: 'active' }
      })
    );
  });
});
