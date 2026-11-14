import { slugify } from '@lowerdeck/slugify';
import { expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { magicMcpServerService } from '../src';
import {
  archiveServer,
  createEndpoint,
  createGroup,
  createReconciledSession,
  createServer,
  isReconciled,
  listServerIds
} from './_fixtures';

describe('module-magic servers', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a backed server with an alias and resolves it by id and alias', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Docs Server');

    let server = await createServer(fixture, {
      name,
      description: 'Docs',
      metadata: { team: 'e2e' }
    });
    expect(server).toMatchObject({
      status: 'active',
      source: 'manual',
      name,
      description: 'Docs',
      metadata: { team: 'e2e' },
      hasSubspaceBacking: true,
      isConsumerReconciled: true
    });
    expect(server.subspaceEphemeralManagedSessionId).toEqual(expect.any(String));
    expect(server.aliases.map(alias => alias.slug)).toEqual([
      expect.stringMatching(new RegExp(`^${slugify(name)}-`))
    ]);

    let row = await db.magicMcpServer.findUniqueOrThrow({ where: { id: server.id } });
    expect(row.instanceOid).toBe(fixture.instance.oid);

    let byAlias = await magicMcpServerService.getMagicMcpServerById({
      instance: fixture.instance,
      magicMcpServerId: server.aliases[0]!.slug
    });
    expect(byAlias.id).toBe(server.id);
    expect(await listServerIds(fixture, { ids: [server.id] })).toEqual([server.id]);
  });

  it('updates a server and adds normalized, unique aliases', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let server = await createServer(fixture, { metadata: { keep: true } });
    let other = await createServer(fixture);
    let alias = uniqueId('Docs Alias');

    let updated = await magicMcpServerService.updateMagicMcpServer({
      server,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: 'Renamed server', aliases: [alias, alias, '  '] }
    });
    expect(updated.name).toBe('Renamed server');
    expect(updated.metadata).toEqual({ keep: true });
    expect(updated.aliases.map(item => item.slug).sort()).toEqual(
      [server.aliases[0]!.slug, slugify(alias)].sort()
    );

    let byNewAlias = await magicMcpServerService.getMagicMcpServerById({
      instance: fixture.instance,
      magicMcpServerId: slugify(alias)
    });
    expect(byNewAlias.id).toBe(server.id);

    await expectServiceError(
      magicMcpServerService.updateMagicMcpServer({
        server: other,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        input: { aliases: [alias] }
      }),
      'conflict'
    );
    expect(await db.magicMcpServerAlias.count({ where: { serverOid: other.oid } })).toBe(1);
  });

  it('archives a server, detaches it from endpoints and refuses further changes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let server = await createServer(fixture);
    let kept = await createServer(fixture);
    let endpoint = await createEndpoint(fixture, [server, kept]);
    let session = await createReconciledSession(endpoint.id);

    let archived = await archiveServer(fixture, server);
    expect(archived.status).toBe('archived');
    expect(archived.deletedAt).toBeTruthy();

    let links = await db.magicMcpEndpointServer.findMany({
      where: { magicMcpEndpointOid: endpoint.oid },
      include: { magicMcpServer: true }
    });
    expect(links.map(link => link.magicMcpServer.id)).toEqual([kept.id]);
    expect(await isReconciled(session)).toBe(false);

    expect(await listServerIds(fixture)).not.toContain(server.id);
    expect(await listServerIds(fixture, { status: ['archived'] })).toContain(server.id);

    let fetched = await magicMcpServerService.getMagicMcpServerById({
      instance: fixture.instance,
      magicMcpServerId: server.id
    });
    expect(fetched.status).toBe('archived');

    await expectServiceError(archiveServer(fixture, archived), 'precondition_failed');
    await expectServiceError(
      magicMcpServerService.updateMagicMcpServer({
        server: archived,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        input: { name: 'Too late' }
      }),
      'precondition_failed'
    );
    await expectServiceError(
      magicMcpServerService.relinkMagicMcpServerIntegrationInstance({
        server: archived,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        integrationInstanceId: uniqueId('ii')
      }),
      'precondition_failed'
    );
  });

  it('filters servers by group, owner and id', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let manual = await createServer(fixture);
    let consumerOwned = await createServer(fixture, { source: 'consumer_provider_template' });
    let group = await createGroup(fixture, [manual]);
    let both = [manual.id, consumerOwned.id];

    expect(await listServerIds(fixture, { groupIds: [group.id] })).toEqual([manual.id]);
    expect(await listServerIds(fixture, { ids: both })).toEqual([manual.id]);
    expect(await listServerIds(fixture, { ids: both, owners: ['consumer'] })).toEqual([
      consumerOwned.id
    ]);
    expect(
      (
        await listServerIds(fixture, { ids: both, owners: ['organization', 'consumer'] })
      ).sort()
    ).toEqual([...both].sort());
  });

  it('hides servers from another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let server = await createServer(fixture);
    let otherServer = await createServer(other);
    let otherGroup = await createGroup(other, [otherServer]);

    for (let magicMcpServerId of [server.id, server.aliases[0]!.slug]) {
      await expectServiceError(
        magicMcpServerService.getMagicMcpServerById({
          instance: other.instance,
          magicMcpServerId
        }),
        'not_found'
      );
    }
    expect(await listServerIds(other, { ids: [server.id] })).toEqual([]);
    expect(await listServerIds(fixture, { groupIds: [otherGroup.id] })).toEqual([]);

    await expectServiceError(
      magicMcpServerService.checkWriteAccess({ server, instance: other.instance }),
      'not_found'
    );
    await expectServiceError(
      magicMcpServerService.updateMagicMcpServer({
        server,
        instance: other.instance,
        auditScope: other.auditScope,
        input: { name: 'Hijacked' }
      }),
      'not_found'
    );
    await expectServiceError(
      magicMcpServerService.listMagicMcpServerProviders({ server, instance: other.instance }),
      'not_found'
    );
    expect(
      (await db.magicMcpServer.findUniqueOrThrow({ where: { id: server.id } })).name
    ).toBe(server.name);
  });
});
