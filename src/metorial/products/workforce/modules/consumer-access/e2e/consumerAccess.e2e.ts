import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { consumerGroupService } from '@metorial/module-consumer-core';
import { describe, expect, it } from 'vitest';
import { consumerAccessListingService, consumerAccessService } from '../src';
import {
  accessTagsFor,
  addToGroups,
  archiveMagicServer,
  canReadMagicServer,
  countGrants,
  createGroup,
  createMagicServer,
  createPortalSurface,
  createProfile,
  createSkill,
  createSurface,
  getEveryoneGroup
} from './_fixtures';

let workerTimeout = { timeoutMs: 60_000, intervalMs: 500 };

describe('module-consumer-access consumer access', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('grants a group access to a magic MCP server and revokes it on delete', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let member = await createProfile(fixture, surface);
    let outsider = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);
    await addToGroups(fixture, member, [group.id]);

    let access = await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: group,
      auditScope: fixture.auditScope,
      access: { type: 'magic_mcp_server', magicMcpServer: server }
    });
    expect(access).toMatchObject({ type: 'magic_mcp_server', accessLevel: null });
    expect(access.magicMcpServer?.id).toBe(server.id);
    expect(access.listing?.name).toBe(server.name);

    let policies = await db.accessTagPolicy.findMany({
      where: {
        organizationOid: fixture.organization.oid,
        systemIdentifier: { startsWith: `consumer_access:${access.id}:` }
      }
    });
    expect(policies.map(policy => policy.systemIdentifier).sort()).toEqual([
      `consumer_access:${access.id}:magic_mcp_connect`,
      `consumer_access:${access.id}:magic_mcp_read`
    ]);

    expect(await canReadMagicServer(server, await accessTagsFor(member))).toBe(true);
    expect(await canReadMagicServer(server, await accessTagsFor(outsider))).toBe(false);

    await consumerAccessService.deleteConsumerAccess({
      organization: fixture.organization,
      consumerAccess: access,
      auditScope: fixture.auditScope
    });
    expect(await db.consumerAccess.findUnique({ where: { id: access.id } })).toBeNull();
    expect(
      await countGrants({ accessTagOid: group.accessTagOid, magicMcpServerOid: server.oid })
    ).toBe(0);
    expect(await canReadMagicServer(server, await accessTagsFor(member))).toBe(false);
    expect(
      await db.consumerAccessListing.findUnique({ where: { id: access.listing!.id } })
    ).not.toBeNull();

    let again = await consumerAccessService.deleteConsumerAccess({
      organization: fixture.organization,
      consumerAccess: access,
      auditScope: fixture.auditScope
    });
    expect(again.id).toBe(access.id);
  });

  it('grants every consumer of the surface through the everyone group', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let otherSurface = await createSurface(fixture);
    let everyone = await getEveryoneGroup(surface);
    let first = await createProfile(fixture, surface);
    let second = await createProfile(fixture, surface);
    let elsewhere = await createProfile(fixture, otherSurface);
    let server = await createMagicServer(fixture);

    await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: everyone,
      auditScope: fixture.auditScope,
      access: { type: 'magic_mcp_server', magicMcpServer: server }
    });

    expect(await canReadMagicServer(server, await accessTagsFor(first))).toBe(true);
    expect(await canReadMagicServer(server, await accessTagsFor(second))).toBe(true);
    expect(await canReadMagicServer(server, await accessTagsFor(elsewhere))).toBe(false);
  });

  it('grants consumers whose SSO groups match the group', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let ssoGroupId = uniqueId('sso');
    let group = await createGroup(fixture, surface, { ssoGroupIds: [ssoGroupId] });
    let profile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);

    await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: group,
      auditScope: fixture.auditScope,
      access: { type: 'magic_mcp_server', magicMcpServer: server }
    });

    expect(await canReadMagicServer(server, await accessTagsFor(profile, [ssoGroupId]))).toBe(
      true
    );
    expect(await canReadMagicServer(server, await accessTagsFor(profile, ['sso-other']))).toBe(
      false
    );
    expect(await canReadMagicServer(server, await accessTagsFor(profile))).toBe(false);
  });

  it('shares one listing between groups and filters accesses', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let first = await createGroup(fixture, surface);
    let second = await createGroup(fixture, surface);
    let server = await createMagicServer(fixture);
    let skill = await createSkill(fixture);
    let create = (consumerGroup: typeof first, input?: { name: string }) =>
      consumerAccessService.createConsumerAccess({
        organization: fixture.organization,
        consumerSurface: surface,
        consumerGroup,
        auditScope: fixture.auditScope,
        access: { type: 'magic_mcp_server', magicMcpServer: server },
        input
      });

    let listingName = uniqueId('Shared Listing');
    let firstAccess = await create(first, { name: listingName });
    let secondAccess = await create(second);
    let skillAccess = await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: first,
      auditScope: fixture.auditScope,
      access: { type: 'skill', skill }
    });
    expect(secondAccess.listing?.id).toBe(firstAccess.listing?.id);
    expect(secondAccess.listing?.name).toBe(listingName);

    let renamed = uniqueId('Renamed Listing');
    await consumerAccessService.updateConsumerAccess({
      consumerAccess: firstAccess,
      auditScope: fixture.auditScope,
      input: { name: renamed, readme: '# Shared' }
    });
    let refetched = await consumerAccessService.getConsumerAccessById({
      consumerSurface: surface,
      consumerAccessId: secondAccess.id
    });
    expect(refetched.listing).toMatchObject({ name: renamed, readme: '# Shared' });

    let list = async (
      filters: Parameters<typeof consumerAccessService.listConsumerAccesses>[0]
    ) =>
      (await firstPage(await consumerAccessService.listConsumerAccesses(filters)))
        .map(item => item.id)
        .sort();

    expect(await list({ consumerSurface: surface })).toEqual(
      [firstAccess.id, secondAccess.id, skillAccess.id].sort()
    );
    expect(
      await list({
        consumerSurface: surface,
        consumerAccessListingIds: [firstAccess.listing!.id]
      })
    ).toEqual([firstAccess.id, secondAccess.id].sort());
    expect(await list({ consumerSurface: surface, consumerGroupIds: [second.id] })).toEqual([
      secondAccess.id
    ]);
    expect(await list({ consumerSurface: surface, types: ['skill'] })).toEqual([
      skillAccess.id
    ]);
    expect(await list({ consumerSurface: surface, magicMcpServerIds: [server.id] })).toEqual(
      [firstAccess.id, secondAccess.id].sort()
    );
    expect(await list({ consumerSurface: surface, search: renamed })).toEqual(
      [firstAccess.id, secondAccess.id].sort()
    );
    expect(
      await list({ consumerSurface: surface, consumerGroupIds: [uniqueId('csg')] })
    ).toEqual([]);
  });

  it('returns the existing access for a repeated grant', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let server = await createMagicServer(fixture);
    let input = {
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: group,
      auditScope: fixture.auditScope,
      access: { type: 'magic_mcp_server' as const, magicMcpServer: server }
    };

    let first = await consumerAccessService.createConsumerAccess(input);
    let second = await consumerAccessService.createConsumerAccess(input);
    expect(second.id).toBe(first.id);
    expect(
      await db.consumerAccess.count({
        where: { consumerGroupOid: group.oid, magicMcpServerOid: server.oid }
      })
    ).toBe(1);
    expect(
      await countGrants({ accessTagOid: group.accessTagOid, magicMcpServerOid: server.oid })
    ).toBe(2);
  });

  it('rejects inactive groups, inactive targets and targets of another instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let base = {
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: group,
      auditScope: fixture.auditScope
    };

    let archivedGroup = await consumerGroupService.deleteConsumerGroup({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: await createGroup(fixture, surface),
      auditScope: fixture.auditScope
    });
    let server = await createMagicServer(fixture);
    await expectServiceError(
      consumerAccessService.createConsumerAccess({
        ...base,
        consumerGroup: archivedGroup,
        access: { type: 'magic_mcp_server', magicMcpServer: server }
      }),
      'precondition_failed'
    );

    let archivedServer = await archiveMagicServer(fixture, await createMagicServer(fixture));
    await expectServiceError(
      consumerAccessService.createConsumerAccess({
        ...base,
        access: { type: 'magic_mcp_server', magicMcpServer: archivedServer }
      }),
      'precondition_failed'
    );

    let foreignServer = await createMagicServer(other);
    let foreignSkill = await createSkill(other);
    await expectServiceError(
      consumerAccessService.createConsumerAccess({
        ...base,
        access: { type: 'magic_mcp_server', magicMcpServer: foreignServer }
      }),
      'not_found'
    );
    await expectServiceError(
      consumerAccessService.createConsumerAccess({
        ...base,
        access: { type: 'skill', skill: foreignSkill }
      }),
      'not_found'
    );

    expect(await db.consumerAccess.count({ where: { surfaceOid: surface.oid } })).toBe(0);
  });

  it('only lets personal groups of a portal access consumer-deployed servers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createPortalSurface(fixture);
    let group = await createGroup(fixture, surface);
    let profile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture, { source: 'consumer_provider_template' });
    let manualServer = await createMagicServer(fixture);
    let base = {
      organization: fixture.organization,
      consumerSurface: surface,
      auditScope: fixture.auditScope
    };

    await expectServiceError(
      consumerAccessService.createConsumerAccess({
        ...base,
        consumerGroup: group,
        access: { type: 'magic_mcp_server', magicMcpServer: server }
      }),
      'not_found'
    );

    let personal = await consumerAccessService.createConsumerAccess({
      ...base,
      consumerGroup: profile.personalConsumerGroup,
      access: { type: 'magic_mcp_server', magicMcpServer: server }
    });
    expect(personal.consumerGroup.type).toBe('user_access');

    let manual = await consumerAccessService.createConsumerAccess({
      ...base,
      consumerGroup: group,
      access: { type: 'magic_mcp_server', magicMcpServer: manualServer }
    });
    expect(manual.consumerGroup.id).toBe(group.id);
  });

  it('cleans up listings, accesses and grants when the target is archived', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let server = await createMagicServer(fixture);

    let access = await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: group,
      auditScope: fixture.auditScope,
      access: { type: 'magic_mcp_server', magicMcpServer: server }
    });
    await archiveMagicServer(fixture, server);

    await expectServiceError(
      consumerAccessService.getConsumerAccessById({
        consumerSurface: surface,
        consumerAccessId: access.id
      }),
      'not_found'
    );
    await expectServiceError(
      consumerAccessListingService.getById({
        consumerSurface: surface,
        consumerAccessListingId: access.listing!.id
      }),
      'not_found'
    );
    let listed = await firstPage(
      await consumerAccessService.listConsumerAccesses({ consumerSurface: surface })
    );
    expect(listed.map(item => item.id)).not.toContain(access.id);

    await eventually(async () => {
      expect(await db.consumerAccess.findUnique({ where: { id: access.id } })).toBeNull();
      expect(
        await db.consumerAccessListing.findUnique({ where: { id: access.listing!.id } })
      ).toBeNull();
    }, workerTimeout);
    expect(
      await countGrants({ accessTagOid: group.accessTagOid, magicMcpServerOid: server.oid })
    ).toBe(0);
  });

  it('does not resolve or list accesses of another surface or organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createSurface(fixture);
    let siblingSurface = await createSurface(fixture);
    let foreignSurface = await createSurface(other);
    let group = await createGroup(fixture, surface);
    let server = await createMagicServer(fixture);

    let access = await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: group,
      auditScope: fixture.auditScope,
      access: { type: 'magic_mcp_server', magicMcpServer: server }
    });

    for (let consumerSurface of [siblingSurface, foreignSurface]) {
      await expectServiceError(
        consumerAccessService.getConsumerAccessById({
          consumerSurface,
          consumerAccessId: access.id
        }),
        'not_found'
      );

      let listed = await firstPage(
        await consumerAccessService.listConsumerAccesses({ consumerSurface })
      );
      expect(listed.map(item => item.id)).not.toContain(access.id);

      let byServer = await firstPage(
        await consumerAccessService.listConsumerAccesses({
          consumerSurface,
          magicMcpServerIds: [server.id]
        })
      );
      expect(byServer).toEqual([]);
    }

    await expectServiceError(
      consumerAccessService.createConsumerAccess({
        organization: other.organization,
        consumerSurface: foreignSurface,
        consumerGroup: group,
        auditScope: other.auditScope,
        access: { type: 'magic_mcp_server', magicMcpServer: server }
      }),
      'not_found'
    );
  });
});
