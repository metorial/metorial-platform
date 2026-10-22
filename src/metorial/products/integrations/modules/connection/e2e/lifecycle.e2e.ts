import { eventually, expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import {
  ephemeralManagedSessionService,
  sessionService,
  sessionTemplateService
} from '@metorial-subspace/module-session';
import { addDays, subMinutes } from 'date-fns';
import { describe, expect, it } from 'vitest';
import {
  connectionEventTypes,
  createEmptySession,
  createManager,
  openConnection,
  scopeOf
} from './_fixtures';

describe('module-connection connection lifecycle', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates an initialized connection for the session with lifecycle events', async () => {
    let session = await createEmptySession(org);
    let { connection } = await openConnection(org, session.id);

    let row = await subspaceDb.sessionConnection.findUniqueOrThrow({
      where: { oid: connection.oid },
      include: { session: true }
    });
    expect(row).toMatchObject({
      status: 'active',
      state: 'connected',
      initState: 'completed',
      transport: 'tool_call',
      mcpTransport: 'none',
      isManuallyDisabled: false,
      isReplaced: false
    });
    expect(row.session.id).toBe(session.id);
    expect(row.participantOid).not.toBeNull();
    expect(row.expiresAt.getTime()).toBeGreaterThan(addDays(new Date(), 1).getTime());

    await eventually(async () => {
      expect(await connectionEventTypes(connection.oid)).toEqual(
        expect.arrayContaining(['connection_created', 'connection_connected'])
      );
    });
  });

  it('reconnects a disconnected connection that is resumed by its token', async () => {
    let session = await createEmptySession(org);
    let { connection } = await openConnection(org, session.id);
    await subspaceDb.sessionConnection.update({
      where: { oid: connection.oid },
      data: { state: 'disconnected', disconnectedAt: new Date() }
    });
    let connectedEvents = (await connectionEventTypes(connection.oid)).filter(
      type => type === 'connection_connected'
    ).length;

    let resumed = await createManager(org, {
      sessionId: session.id,
      connectionToken: connection.token
    });
    expect(resumed.connection?.id).toBe(connection.id);

    await eventually(async () => {
      let row = await subspaceDb.sessionConnection.findUniqueOrThrow({
        where: { oid: connection.oid }
      });
      expect(row).toMatchObject({ state: 'connected', disconnectedAt: null });

      let events = await connectionEventTypes(connection.oid);
      expect(events.filter(type => type === 'connection_connected')).toHaveLength(
        connectedEvents + 1
      );
    });
  });

  it('extends an expired initialized connection and rejects an expired uninitialized one', async () => {
    let session = await createEmptySession(org);
    let { connection } = await openConnection(org, session.id);
    await subspaceDb.sessionConnection.update({
      where: { oid: connection.oid },
      data: { expiresAt: subMinutes(new Date(), 1) }
    });

    await createManager(org, { sessionId: session.id, connectionToken: connection.token });

    let extended = await subspaceDb.sessionConnection.findUniqueOrThrow({
      where: { oid: connection.oid }
    });
    expect(extended.expiresAt.getTime()).toBeGreaterThan(addDays(new Date(), 1).getTime());

    let pending = await (
      await createManager(org, { sessionId: session.id })
    ).createConnection();
    expect(pending.initState).toBe('pending');
    await subspaceDb.sessionConnection.update({
      where: { oid: pending.oid },
      data: { expiresAt: subMinutes(new Date(), 1) }
    });

    let error = await expectServiceError(
      createManager(org, { sessionId: session.id, connectionToken: pending.token }),
      'bad_request'
    );
    expect(error.message).toBe('Connection not initialized in time');
  });

  it('rejects a disabled connection and a connection used with another transport', async () => {
    let session = await createEmptySession(org);
    let { manager, connection } = await openConnection(org, session.id);

    let other = await openConnection(org, session.id);
    let error = await expectServiceError(
      createManager(org, {
        sessionId: session.id,
        connectionToken: other.connection.token,
        transport: 'mcp'
      }),
      'bad_request'
    );
    expect(error.message).toBe('Connection cannot be used with transport mcp');

    await manager.disableConnection();

    let row = await subspaceDb.sessionConnection.findUniqueOrThrow({
      where: { oid: connection.oid }
    });
    expect(row).toMatchObject({ isManuallyDisabled: true, state: 'disconnected' });
    expect(row.disconnectedAt).toBeInstanceOf(Date);
    expect(await connectionEventTypes(connection.oid)).toContain('connection_disabled');

    await expectServiceError(
      createManager(org, { sessionId: session.id, connectionToken: connection.token }),
      'gone'
    );
  });

  it('rejects senders for an archived session', async () => {
    let session = await createEmptySession(org);
    let { fixture } = await scopeOf(org);

    await sessionService.archiveSession({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      session: await sessionService.getSessionById({
        instance: fixture.instance,
        sessionId: session.id
      })
    });

    await expectServiceError(createManager(org, { sessionId: session.id }), 'gone');
  });

  it("does not resolve another tenant's session or connection", async () => {
    let session = await createEmptySession(org);
    let { connection } = await openConnection(org, session.id);
    let otherSession = await createEmptySession(otherOrg);

    await expectServiceError(createManager(otherOrg, { sessionId: session.id }), 'not_found');
    await expectServiceError(
      createManager(otherOrg, {
        sessionId: otherSession.id,
        connectionToken: connection.token
      }),
      'not_found'
    );
  });

  it('rejects a connection token of another session of the same tenant', async () => {
    let [session, otherSession] = await Promise.all([
      createEmptySession(org),
      createEmptySession(org)
    ]);
    let { connection } = await openConnection(org, otherSession.id);

    let data = await expectServiceError(
      createManager(org, { sessionId: session.id, connectionToken: connection.token }),
      'not_found'
    );
    expect(data.entity).toBe('connection');

    let own = await createManager(org, {
      sessionId: otherSession.id,
      connectionToken: connection.token
    });
    expect(own.connection?.id).toBe(connection.id);
  });

  it('resolves a connection token through its ephemeral managed session id', async () => {
    let { fixture } = await scopeOf(org);
    let scope = {
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope
    };

    let created = await sessionTemplateService.createSessionTemplate({
      ...scope,
      input: { name: uniqueId('ephemeral-template'), providers: [] }
    });
    let template = await eventually(async () => {
      let row = await subspaceDb.sessionTemplate.findUniqueOrThrow({
        where: { oid: created.oid }
      });
      expect(row.hash).toMatch(/\S/);
      return row;
    });
    let ephemeralSession = await ephemeralManagedSessionService.createEphemeralManagedSession({
      ...scope,
      sessionTemplate: { ...template, providers: [] },
      input: { maxSessionDurationInMinutes: 60 }
    });

    let { connection } = await openConnection(org, ephemeralSession.id);
    let row = await subspaceDb.sessionConnection.findUniqueOrThrow({
      where: { oid: connection.oid },
      include: { session: true }
    });
    expect(row.session.ephemeralManagedSessionOid).toBe(ephemeralSession.oid);
    let backingSessionId = row.session.id;

    for (let sessionId of [ephemeralSession.id, backingSessionId]) {
      let manager = await createManager(org, { sessionId, connectionToken: connection.token });
      expect(manager.connection?.id).toBe(connection.id);
      expect(manager.session.id).toBe(backingSessionId);
    }

    let otherSession = await createEmptySession(org);
    await expectServiceError(
      createManager(org, { sessionId: otherSession.id, connectionToken: connection.token }),
      'not_found'
    );
  });
});
