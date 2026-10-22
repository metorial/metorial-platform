import {
  createRemoteProvider,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ensureMagicMcpSubspaceSession,
  magicMcpEndpointService,
  magicMcpServerService,
  magicMcpSessionService,
  resolveMagicMcpTargetByIdOrAlias,
  resolveMagicMcpTargetByIdOrAliasSafe
} from '../src';
import { archiveServer, createEndpoint, createServer, ids, syncSession } from './_fixtures';

let dropServerBacking = async (server: { oid: bigint }) =>
  await db.magicMcpServer.update({
    where: { oid: server.oid },
    data: { hasSubspaceBacking: false, subspaceEphemeralManagedSessionId: null }
  });

let dropEndpointBacking = async (endpoint: { oid: bigint }) =>
  await db.magicMcpEndpoint.update({
    where: { oid: endpoint.oid },
    data: { hasSubspaceBacking: false, subspaceEphemeralManagedSessionId: null }
  });

let ensureSession = async (targetId: string) =>
  await ensureMagicMcpSubspaceSession(await resolveMagicMcpTargetByIdOrAlias(targetId));

describe('module-magic sessions', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let mcpServer = useMcpTestServer();

  let providerId: string;

  beforeAll(async () => {
    ({ providerId } = await createRemoteProvider(org.clients.instance, {
      url: mcpServer.url
    }));
  }, 180_000);

  it('resolves active servers and endpoints by id, alias and slug', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let server = await createServer(fixture);
    let endpoint = await createEndpoint(fixture, [server]);
    let alias = server.aliases[0]!.slug;

    for (let [targetId, type, id] of [
      [server.id, 'server', server.id],
      [alias, 'server', server.id],
      [endpoint.id, 'endpoint', endpoint.id],
      [endpoint.slug, 'endpoint', endpoint.id]
    ] as const) {
      let target = await resolveMagicMcpTargetByIdOrAlias(targetId);
      expect({ type: target.type, id: target.target.id }).toEqual({ type, id });
      expect(target.target.instance.id).toBe(fixture.instance.id);
    }

    expect(await resolveMagicMcpTargetByIdOrAliasSafe(uniqueId('mms'))).toBeNull();
    await expectServiceError(resolveMagicMcpTargetByIdOrAlias(uniqueId('mms')), 'not_found');

    await magicMcpEndpointService.archiveMagicMcpEndpoint({
      endpoint,
      auditScope: fixture.auditScope
    });
    await archiveServer(fixture, server);
    for (let targetId of [alias, server.id, endpoint.id, endpoint.slug]) {
      await expectServiceError(resolveMagicMcpTargetByIdOrAlias(targetId), 'not_found');
    }
  });

  it('reuses the backing session of a backed server or endpoint', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let server = await createServer(fixture);
    await magicMcpServerService.createMagicMcpServerProvider({
      server,
      instance: fixture.instance,
      input: { providerId }
    });
    let endpoint = await createEndpoint(fixture, [server]);

    let serverSessionId = await ensureSession(server.id);
    let serverRow = await db.magicMcpServer.findUniqueOrThrow({ where: { oid: server.oid } });
    expect(serverSessionId).toBe(serverRow.subspaceEphemeralManagedSessionId);
    expect(await ensureSession(server.id)).toBe(serverSessionId);

    let endpointSessionId = await ensureSession(endpoint.slug);
    let endpointRow = await db.magicMcpEndpoint.findUniqueOrThrow({
      where: { oid: endpoint.oid }
    });
    expect(endpointSessionId).toBe(endpointRow.subspaceEphemeralManagedSessionId);
    expect(endpointSessionId).not.toBe(serverSessionId);
  });

  it('backs an unbacked server again but only connects it once it has providers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let server = await createServer(fixture);
    await dropServerBacking(server);

    await expectServiceError(
      ensureSession(server.id),
      'magic_mcp_backing_providers_unavailable'
    );
    let rebacked = await db.magicMcpServer.findUniqueOrThrow({ where: { oid: server.oid } });
    expect(rebacked.hasSubspaceBacking).toBe(true);
    expect(rebacked.subspaceEphemeralManagedSessionId).toEqual(expect.any(String));

    let attached = await magicMcpServerService.createMagicMcpServerProvider({
      server: rebacked,
      instance: fixture.instance,
      input: { providerId }
    });
    expect(attached.magicMcpServerBacking.id).toBe(server.id);

    await dropServerBacking(server);
    let sessionId = await ensureSession(server.id);
    let row = await db.magicMcpServer.findUniqueOrThrow({ where: { oid: server.oid } });
    expect(row.hasSubspaceBacking).toBe(true);
    expect(sessionId).toBe(row.subspaceEphemeralManagedSessionId);
  });

  it.fails(
    'reports missing providers when connecting a backed server without any (bug: the backing status treats the provider-less integration instance as needs_reconnect)',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);
      let server = await createServer(fixture);

      await expectServiceError(
        ensureSession(server.id),
        'magic_mcp_backing_providers_unavailable'
      );
    }
  );

  it('refuses to connect an unbacked endpoint without servers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let endpoint = await createEndpoint(fixture, []);
    await dropEndpointBacking(endpoint);

    await expectServiceError(
      ensureSession(endpoint.id),
      'magic_mcp_endpoint_servers_unavailable'
    );
  });

  it('keeps one magic session per target and re-flags it when the session changes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let server = await createServer(fixture);
    let endpoint = await createEndpoint(fixture, [server]);
    let backingSessionId = uniqueId('ems');

    let created = await syncSession(server.id, {
      subspaceSessionId: 'first',
      backingSessionId
    });
    expect(created).toMatchObject({
      magicMcpServerOid: server.oid,
      magicMcpEndpointOid: null,
      instanceOid: fixture.instance.oid,
      subspaceSessionId: 'first',
      subspaceSessionTemplateId: backingSessionId,
      isActive: true,
      isConsumerReconciled: false,
      expiresAt: null
    });

    await db.magicMcpSession.update({
      where: { oid: created.oid },
      data: { isConsumerReconciled: true }
    });
    let same = await syncSession(server.id, { subspaceSessionId: 'first', backingSessionId });
    expect(same.oid).toBe(created.oid);
    expect(same.isConsumerReconciled).toBe(true);

    let changed = await syncSession(server.id, {
      subspaceSessionId: 'second',
      backingSessionId
    });
    expect(changed.oid).toBe(created.oid);
    expect(changed).toMatchObject({
      subspaceSessionId: 'second',
      isConsumerReconciled: false
    });

    await db.magicMcpSession.update({
      where: { oid: created.oid },
      data: { isActive: false, isConsumerReconciled: true }
    });
    let reactivated = await syncSession(server.id, {
      subspaceSessionId: 'second',
      backingSessionId
    });
    expect(reactivated).toMatchObject({ isActive: true, isConsumerReconciled: false });
    expect(await db.magicMcpSession.count({ where: { magicMcpServerOid: server.oid } })).toBe(
      1
    );

    let endpointSession = await syncSession(endpoint.id);
    expect(endpointSession.oid).not.toBe(created.oid);
    expect(endpointSession).toMatchObject({
      magicMcpServerOid: null,
      magicMcpEndpointOid: endpoint.oid
    });
  });

  it('lists the sessions of a server and its endpoints within the instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let server = await createServer(fixture);
    let unrelated = await createServer(fixture);
    let endpoint = await createEndpoint(fixture, [server]);

    let serverSession = await syncSession(server.id);
    let endpointSession = await syncSession(endpoint.id);
    let unrelatedSession = await syncSession(unrelated.id);

    let listed = ids(
      await firstPage(
        await magicMcpSessionService.listMagicMcpSessions({
          instance: fixture.instance,
          magicMcpServerId: [server.id]
        })
      )
    );
    expect(listed.sort()).toEqual([serverSession.id, endpointSession.id].sort());
    expect(listed).not.toContain(unrelatedSession.id);

    let fetched = await magicMcpSessionService.getMagicMcpSessionById({
      instance: fixture.instance,
      magicMcpSessionId: serverSession.id
    });
    expect(fetched.magicMcpServer?.id).toBe(server.id);

    await expectServiceError(
      magicMcpSessionService.getMagicMcpSessionById({
        instance: other.instance,
        magicMcpSessionId: serverSession.id
      }),
      'not_found'
    );
    expect(
      ids(
        await firstPage(
          await magicMcpSessionService.listMagicMcpSessions({
            instance: other.instance,
            magicMcpServerId: [server.id]
          })
        )
      )
    ).toEqual([]);
  });
});
