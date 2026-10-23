import {
  connectSession,
  createRemoteProvider,
  eventually,
  expectServiceError,
  findTool,
  firstPage,
  startMcpTestServer,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  sessionConnectionService,
  sessionErrorService,
  sessionEventService,
  sessionService
} from '../src';
import { createDeployment, sessionScope, useRemoteProviders } from './_fixtures';

let messageProcessingErrorTypes = [
  'message_processing_provider_error',
  'message_processing_system_error',
  'message_processing_timeout'
];

describe('module-session session activity', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let providers = useRemoteProviders({ org, otherOrg, server });

  let createSession = async (providerId: string) => {
    let deploymentId = await createDeployment(org, providerId);
    let scope = await sessionScope(org);
    let session = await sessionService.createSession({
      ...scope,
      input: { name: uniqueId('session'), providers: [{ deploymentId }] }
    });

    return { scope, session };
  };

  it('records connections and events for MCP traffic and tears them down on archive', async () => {
    let { scope, session } = await createSession(providers.first);
    let sessionProvider = session.providers[0]!;
    let client = connectSession(session.id, org.keys.instanceSecret);

    expect((await client.initialize()).status).toBe(200);
    let tools = await client.listTools();
    let add = findTool(tools.result.tools, 'add');
    let call = await client.request('tools/call', {
      name: add.name,
      arguments: { a: 4, b: 5 }
    });
    expect(call.result.content).toEqual([{ type: 'text', text: '9' }]);

    let connection = await eventually(async () => {
      let connections = await firstPage(
        await sessionConnectionService.listSessionConnections({
          ...scope,
          sessionIds: [session.id]
        })
      );
      expect(connections).toHaveLength(1);
      return connections[0]!;
    });
    expect(connection.status).toBe('active');

    let events = await eventually(async () => {
      let events = await firstPage(
        await sessionEventService.listSessionEvents({ ...scope, sessionIds: [session.id] })
      );
      expect(events.map(event => event.type)).toEqual(
        expect.arrayContaining([
          'session_created',
          'connection_created',
          'session_started',
          'message_created'
        ])
      );
      return events;
    });
    expect(new Set(events.map(event => event.id)).size).toBe(events.length);

    let connectionEvents = await firstPage(
      await sessionEventService.listSessionEvents({
        ...scope,
        sessionIds: [session.id],
        types: ['connection_created']
      })
    );
    expect(connectionEvents.length).toBeGreaterThanOrEqual(1);
    expect(connectionEvents.every(event => event.type === 'connection_created')).toBe(true);
    expect(connectionEvents.every(event => event.connection?.id === connection.id)).toBe(true);

    let byConnection = await firstPage(
      await sessionEventService.listSessionEvents({
        ...scope,
        sessionConnectionIds: [connection.id]
      })
    );
    expect(byConnection.length).toBeGreaterThanOrEqual(1);
    expect(byConnection.map(event => event.type)).not.toContain('session_created');

    await eventually(async () => {
      let providerEvents = await firstPage(
        await sessionEventService.listSessionEvents({
          ...scope,
          sessionProviderIds: [sessionProvider.id]
        })
      );
      expect(providerEvents.length).toBeGreaterThanOrEqual(1);
      expect(providerEvents.every(event => event.session.id === session.id)).toBe(true);
    });

    let otherScope = await sessionScope(otherOrg);
    expect(
      await firstPage(
        await sessionConnectionService.listSessionConnections({
          ...otherScope,
          sessionIds: [session.id]
        })
      )
    ).toEqual([]);
    await expectServiceError(
      sessionEventService.getSessionEventById({
        ...otherScope,
        sessionEventId: events[0]!.id
      }),
      'not_found'
    );

    let sessionRow = await subspaceDb.session.findUniqueOrThrow({ where: { id: session.id } });
    await sessionService.archiveSession({
      ...scope,
      session: await sessionService.getSessionById({ ...scope, sessionId: session.id })
    });

    await eventually(async () => {
      let connections = await subspaceDb.sessionConnection.findMany({
        where: { sessionOid: sessionRow.oid }
      });
      expect(connections.length).toBeGreaterThanOrEqual(1);
      for (let row of connections) {
        expect(row).toMatchObject({
          status: 'deleted',
          state: 'disconnected',
          isParentDeleted: true
        });
      }

      let runs = await subspaceDb.providerRun.findMany({
        where: { sessionOid: sessionRow.oid }
      });
      expect(runs.every(run => run.status !== 'running' && run.isParentDeleted)).toBe(true);

      let sessionProviders = await subspaceDb.sessionProvider.findMany({
        where: { sessionOid: sessionRow.oid }
      });
      expect(sessionProviders.map(row => [row.status, row.isParentDeleted])).toEqual([
        ['archived', true]
      ]);
    });

    await eventually(async () => {
      let eventRows = await subspaceDb.sessionEvent.findMany({
        where: { sessionOid: sessionRow.oid }
      });
      expect(eventRows.length).toBeGreaterThanOrEqual(events.length);
      expect(eventRows.every(row => row.isParentDeleted)).toBe(true);
    });

    expect(
      await firstPage(
        await sessionEventService.listSessionEvents({ ...scope, sessionIds: [session.id] })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await sessionConnectionService.listSessionConnections({
          ...scope,
          sessionIds: [session.id]
        })
      )
    ).toEqual([]);

    await expectServiceError(
      sessionEventService.getSessionEventById({ ...scope, sessionEventId: events[0]!.id }),
      'not_found'
    );
    let deletedEvent = await sessionEventService.getSessionEventById({
      ...scope,
      sessionEventId: events[0]!.id,
      allowDeleted: true
    });
    expect(deletedEvent.id).toBe(events[0]!.id);
  }, 180_000);

  it('lists the session errors recorded when a provider becomes unreachable', async () => {
    let upstream = startMcpTestServer();

    try {
      let remote = await createRemoteProvider(org.clients.instance, { url: upstream.url });
      let { scope, session } = await createSession(remote.providerId);
      let { session: quietSession } = await createSession(providers.first);
      let client = connectSession(session.id, org.keys.instanceSecret);

      await client.initialize();
      let echo = findTool((await client.listTools()).result.tools, 'echo');

      await upstream.stop();
      await client.request('tools/call', {
        name: echo.name,
        arguments: { text: 'unreachable' }
      });

      let error = await eventually(
        async () => {
          let errors = await firstPage(
            await sessionErrorService.listSessionErrors({ ...scope, sessionIds: [session.id] })
          );
          expect(errors.length).toBeGreaterThanOrEqual(1);
          return errors[0]!;
        },
        { timeoutMs: 60_000 }
      );
      expect(messageProcessingErrorTypes).toContain(error.type);
      expect(error.session.id).toBe(session.id);
      expect(error.code).toBeTruthy();
      expect(error.message).toBeTruthy();

      let fetched = await sessionErrorService.getSessionErrorById({
        ...scope,
        sessionErrorId: error.id
      });
      expect(fetched.id).toBe(error.id);

      let ofType = await firstPage(
        await sessionErrorService.listSessionErrors({
          ...scope,
          sessionIds: [session.id],
          types: [error.type]
        })
      );
      expect(ofType.map(item => item.id)).toContain(error.id);

      let otherTypes = await firstPage(
        await sessionErrorService.listSessionErrors({
          ...scope,
          sessionIds: [session.id],
          types: ['provider_discovery_failed']
        })
      );
      expect(otherTypes.map(item => item.id)).not.toContain(error.id);

      let ofQuietSession = await firstPage(
        await sessionErrorService.listSessionErrors({
          ...scope,
          sessionIds: [quietSession.id]
        })
      );
      expect(ofQuietSession).toEqual([]);

      let byId = await firstPage(
        await sessionErrorService.listSessionErrors({ ...scope, ids: [error.id] })
      );
      expect(byId.map(item => item.id)).toEqual([error.id]);

      let otherScope = await sessionScope(otherOrg);
      await expectServiceError(
        sessionErrorService.getSessionErrorById({ ...otherScope, sessionErrorId: error.id }),
        'not_found'
      );
      expect(
        await firstPage(
          await sessionErrorService.listSessionErrors({ ...otherScope, ids: [error.id] })
        )
      ).toEqual([]);
    } finally {
      await upstream.stop();
    }
  }, 180_000);
});
