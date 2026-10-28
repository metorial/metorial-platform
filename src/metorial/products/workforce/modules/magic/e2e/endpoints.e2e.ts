import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { magicMcpEndpointService } from '../src';
import {
  archiveServer,
  createEndpoint,
  createReconciledSession,
  createServer,
  ids,
  isReconciled,
  sortedIds
} from './_fixtures';

let linkedServerIds = (endpoint: { servers: { magicMcpServer: { id: string } }[] }) =>
  endpoint.servers.map(link => link.magicMcpServer.id).sort();

let listEndpointIds = async (
  fixture: OrganizationFixture,
  filters: Omit<
    Parameters<typeof magicMcpEndpointService.listMagicMcpEndpoints>[0],
    'instance'
  > = {}
) =>
  ids(
    await firstPage(
      await magicMcpEndpointService.listMagicMcpEndpoints({
        instance: fixture.instance,
        ...filters
      })
    )
  );

describe('module-magic endpoints', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a backed endpoint with deduplicated servers and finds it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let first = await createServer(fixture);
    let second = await createServer(fixture);
    let name = uniqueId('Docs Endpoint');

    let endpoint = await createEndpoint(fixture, [first, second, first], {
      name,
      description: 'Searchable endpoint',
      metadata: { team: 'e2e' }
    });
    expect(endpoint).toMatchObject({
      status: 'active',
      name,
      metadata: { team: 'e2e' },
      hasSubspaceBacking: true
    });
    expect(endpoint.slug.startsWith('docs-endpoint-')).toBe(true);
    expect(endpoint.subspaceEphemeralManagedSessionId).toEqual(expect.any(String));
    expect(linkedServerIds(endpoint)).toEqual(sortedIds([first, second]));
    expect(
      await db.magicMcpEndpointServer.count({ where: { magicMcpEndpointOid: endpoint.oid } })
    ).toBe(2);

    let bySlug = await magicMcpEndpointService.getMagicMcpEndpointByIdOrSlug({
      instance: fixture.instance,
      magicMcpEndpointIdOrSlug: endpoint.slug
    });
    expect(bySlug.id).toBe(endpoint.id);

    expect(await listEndpointIds(fixture, { magicMcpServerIds: [second.id] })).toEqual([
      endpoint.id
    ]);
    expect(await listEndpointIds(fixture, { search: name })).toEqual([endpoint.id]);
  });

  it('updates an endpoint and keeps omitted fields', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let endpoint = await createEndpoint(fixture, [], {
      description: 'Initial',
      metadata: { keep: true }
    });

    let updated = await magicMcpEndpointService.updateMagicMcpEndpoint({
      endpoint,
      auditScope: fixture.auditScope,
      input: { name: 'Renamed endpoint', description: null }
    });
    expect(updated).toMatchObject({
      name: 'Renamed endpoint',
      description: null,
      metadata: { keep: true },
      slug: endpoint.slug
    });

    let row = await db.magicMcpEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } });
    expect(row.name).toBe('Renamed endpoint');
  });

  it('links and unlinks servers and flags endpoint sessions for consumer reconciliation', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let first = await createServer(fixture);
    let second = await createServer(fixture);
    let endpoint = await createEndpoint(fixture, [first]);
    let session = await createReconciledSession(endpoint.id);

    let refiltered = await magicMcpEndpointService.addServersToEndpoint({
      endpoint,
      servers: [
        { magicMcpServerId: first.id, toolFilters: { type: 'tool_keys', keys: ['echo'] } }
      ],
      auditScope: fixture.auditScope
    });
    expect(linkedServerIds(refiltered)).toEqual([first.id]);
    expect(refiltered.servers[0]!.toolFilters).toEqual({ type: 'tool_keys', keys: ['echo'] });
    expect(await isReconciled(session)).toBe(true);

    let added = await magicMcpEndpointService.addServersToEndpoint({
      endpoint,
      servers: [{ magicMcpServerId: second.id }],
      auditScope: fixture.auditScope
    });
    expect(linkedServerIds(added)).toEqual(sortedIds([first, second]));
    expect(await isReconciled(session)).toBe(false);

    await db.magicMcpSession.update({
      where: { oid: session.oid },
      data: { isConsumerReconciled: true }
    });

    let untouched = await magicMcpEndpointService.removeServersFromEndpoint({
      endpoint,
      magicMcpServerIds: [uniqueId('mms')],
      auditScope: fixture.auditScope
    });
    expect(linkedServerIds(untouched)).toEqual(sortedIds([first, second]));
    expect(await isReconciled(session)).toBe(true);

    let removed = await magicMcpEndpointService.removeServersFromEndpoint({
      endpoint,
      magicMcpServerIds: [first.id],
      auditScope: fixture.auditScope
    });
    expect(linkedServerIds(removed)).toEqual([second.id]);
    expect(await isReconciled(session)).toBe(false);
  });

  it('only links active servers of its own instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let active = await createServer(fixture);
    let archived = await archiveServer(fixture, await createServer(fixture));
    let foreign = await createServer(other);
    let endpoint = await createEndpoint(fixture, [active]);

    await expectServiceError(
      magicMcpEndpointService.addServersToEndpoint({
        endpoint,
        servers: [{ magicMcpServerId: archived.id }],
        auditScope: fixture.auditScope
      }),
      'precondition_failed'
    );

    for (let magicMcpServerId of [uniqueId('mms'), foreign.id]) {
      await expectServiceError(
        magicMcpEndpointService.addServersToEndpoint({
          endpoint,
          servers: [{ magicMcpServerId }],
          auditScope: fixture.auditScope
        }),
        'not_found'
      );
    }
    expect(
      await db.magicMcpEndpointServer.count({ where: { magicMcpEndpointOid: endpoint.oid } })
    ).toBe(1);

    let name = uniqueId('Rejected Endpoint');
    await expectServiceError(
      createEndpoint(fixture, [active, archived], { name }),
      'precondition_failed'
    );
    await expectServiceError(
      createEndpoint(fixture, [active, foreign], { name }),
      'not_found'
    );
    await expectServiceError(
      createEndpoint(fixture, [active, { id: uniqueId('mms') }], { name }),
      'not_found'
    );
    expect(await db.magicMcpEndpoint.count({ where: { name } })).toBe(0);
  });

  it('archives an endpoint and refuses further changes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let endpoint = await createEndpoint(fixture, [await createServer(fixture)]);

    let archived = await magicMcpEndpointService.archiveMagicMcpEndpoint({
      endpoint,
      auditScope: fixture.auditScope
    });
    expect(archived.status).toBe('archived');
    expect(archived.deletedAt).toBeTruthy();

    expect(await listEndpointIds(fixture)).not.toContain(endpoint.id);
    expect(await listEndpointIds(fixture, { status: ['archived'] })).toContain(endpoint.id);
    await expectServiceError(
      magicMcpEndpointService.getMagicMcpEndpointByIdOrSlug({
        instance: fixture.instance,
        magicMcpEndpointIdOrSlug: endpoint.slug
      }),
      'not_found'
    );

    let fetched = await magicMcpEndpointService.getMagicMcpEndpointById({
      instance: fixture.instance,
      magicMcpEndpointId: endpoint.id
    });
    expect(fetched.status).toBe('archived');

    await expectServiceError(
      magicMcpEndpointService.archiveMagicMcpEndpoint({
        endpoint: archived,
        auditScope: fixture.auditScope
      }),
      'precondition_failed'
    );
    await expectServiceError(
      magicMcpEndpointService.updateMagicMcpEndpoint({
        endpoint: archived,
        auditScope: fixture.auditScope,
        input: { name: 'Too late' }
      }),
      'precondition_failed'
    );
  });

  it('hides endpoints from another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let server = await createServer(fixture);
    let endpoint = await createEndpoint(fixture, [server]);

    await expectServiceError(
      magicMcpEndpointService.getMagicMcpEndpointById({
        instance: other.instance,
        magicMcpEndpointId: endpoint.id
      }),
      'not_found'
    );
    await expectServiceError(
      magicMcpEndpointService.getMagicMcpEndpointByIdOrSlug({
        instance: other.instance,
        magicMcpEndpointIdOrSlug: endpoint.slug
      }),
      'not_found'
    );
    await expectServiceError(
      magicMcpEndpointService.checkWriteAccess({ endpoint, instance: other.instance }),
      'not_found'
    );

    await createEndpoint(other, []);
    expect(await listEndpointIds(other, { search: endpoint.slug })).toEqual([]);
    expect(await listEndpointIds(other, { magicMcpServerIds: [server.id] })).toEqual([]);
    expect(await listEndpointIds(fixture, { magicMcpServerIds: [uniqueId('mms')] })).toEqual(
      []
    );
  });
});
