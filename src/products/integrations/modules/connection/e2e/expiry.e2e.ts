import {
  createRemoteProvider,
  eventually,
  findTool,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { subHours, subMinutes } from 'date-fns';
import { v7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectionCleanupCron } from '../src/cron/cleanup';
import {
  connectionEventTypes,
  createEmptySession,
  openConnection,
  openMcpSession,
  triggerCron
} from './_fixtures';

describe('module-connection expiry crons', () => {
  let org = useOrganization();

  it('disconnects connections that have been inactive for over two minutes', async () => {
    let session = await createEmptySession(org);
    let stale = await openConnection(org, session.id);
    let fresh = await openConnection(org, session.id);
    await subspaceDb.sessionConnection.update({
      where: { oid: stale.connection.oid },
      data: { lastActiveAt: subMinutes(new Date(), 10) }
    });
    await subspaceDb.sessionConnection.update({
      where: { oid: fresh.connection.oid },
      data: { lastActiveAt: new Date() }
    });

    await triggerCron('sub/con/conn/expire/cron');

    await eventually(async () => {
      let row = await subspaceDb.sessionConnection.findUniqueOrThrow({
        where: { oid: stale.connection.oid }
      });
      expect(row.state).toBe('disconnected');
      expect(row.disconnectedAt).toBeInstanceOf(Date);
      expect(await connectionEventTypes(row.oid)).toContain('connection_disconnected');
    });

    let freshRow = await subspaceDb.sessionConnection.findUniqueOrThrow({
      where: { oid: fresh.connection.oid }
    });
    expect(freshRow.state).toBe('connected');
    expect(await connectionEventTypes(freshRow.oid)).not.toContain('connection_disconnected');
  });

  it('marks sessions without recent activity as disconnected', async () => {
    let [stale, fresh] = await Promise.all([createEmptySession(org), createEmptySession(org)]);
    await subspaceDb.session.update({
      where: { id: stale.id },
      data: { connectionState: 'connected', lastActiveAt: subMinutes(new Date(), 10) }
    });
    await subspaceDb.session.update({
      where: { id: fresh.id },
      data: { connectionState: 'connected', lastActiveAt: new Date() }
    });

    await triggerCron('sub/con/ses/expire');

    await eventually(async () => {
      let row = await subspaceDb.session.findUniqueOrThrow({ where: { id: stale.id } });
      expect(row.connectionState).toBe('disconnected');
    });
    expect(
      (await subspaceDb.session.findUniqueOrThrow({ where: { id: fresh.id } })).connectionState
    ).toBe('connected');
  });
});

describe('module-connection usage record cleanup', () => {
  let org = useOrganization();
  let server = useMcpTestServer();
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );

  let workers: { close: () => any } | undefined | void;

  beforeAll(async () => {
    workers = await connectionCleanupCron.start();
  });

  afterAll(async () => {
    await workers?.close();
  });

  it('deletes provider run usage records older than two hours and keeps recent ones', async () => {
    let { client, tools } = await openMcpSession(org, remote.providerId);
    await client.request('tools/call', {
      name: findTool(tools, 'echo').name,
      arguments: { text: 'usage' }
    });

    let connection = await subspaceDb.sessionConnection.findUniqueOrThrow({
      where: { token: client.sessionId! }
    });
    let stale = await eventually(async () => {
      let run = await subspaceDb.providerRun.findFirstOrThrow({
        where: { connectionOid: connection.oid }
      });
      return await subspaceDb.providerRunUsageRecord.findFirstOrThrow({
        where: { providerRunOid: run.oid }
      });
    });

    await subspaceDb.providerRunUsageRecord.update({
      where: { id: stale.id },
      data: { createdAt: subHours(new Date(), 3) }
    });
    let recent = await subspaceDb.providerRunUsageRecord.create({
      data: {
        id: v7(),
        providerRunOid: stale.providerRunOid,
        tenantOid: stale.tenantOid,
        projectOid: stale.projectOid,
        solutionOid: stale.solutionOid
      }
    });

    await triggerCron('sub/con/cleanup');

    await eventually(async () => {
      expect(
        await subspaceDb.providerRunUsageRecord.findUnique({ where: { id: stale.id } })
      ).toBeNull();
    });
    expect(
      await subspaceDb.providerRunUsageRecord.findUnique({ where: { id: recent.id } })
    ).not.toBeNull();
  }, 180_000);
});
