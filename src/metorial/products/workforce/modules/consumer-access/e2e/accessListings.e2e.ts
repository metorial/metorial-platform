import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { consumerAccessListingService, consumerAccessService } from '../src';
import {
  addToGroups,
  accessTagsFor,
  archiveMagicServer,
  canReadMagicServer,
  countGrants,
  createGroup,
  createMagicServer,
  createProfile,
  createSkill,
  createSurface
} from './_fixtures';

describe('module-consumer-access access listings', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a listing with target defaults and upserts it per target', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let server = await createMagicServer(fixture);

    let listing = await consumerAccessListingService.create({
      consumerSurface: surface,
      auditScope: fixture.auditScope,
      input: { access: { type: 'magic_mcp_server', magicMcpServerId: server.id } }
    });
    expect(listing).toMatchObject({
      name: server.name,
      description: server.description,
      readme: null,
      surfaceOid: surface.oid
    });
    expect(listing.magicMcpServer?.id).toBe(server.id);

    let name = uniqueId('Listing');
    let upserted = await consumerAccessListingService.create({
      consumerSurface: surface,
      auditScope: fixture.auditScope,
      input: {
        name,
        readme: '# Readme',
        access: { type: 'magic_mcp_server', magicMcpServerId: server.id }
      }
    });
    expect(upserted.id).toBe(listing.id);
    expect(upserted).toMatchObject({ name, readme: '# Readme' });
    expect(
      await db.consumerAccessListing.count({
        where: { surfaceOid: surface.oid, magicMcpServerOid: server.oid }
      })
    ).toBe(1);

    let updated = await consumerAccessListingService.update({
      consumerAccessListing: upserted,
      auditScope: fixture.auditScope,
      input: { description: 'Updated by e2e' }
    });
    expect(updated).toMatchObject({ name, description: 'Updated by e2e', readme: '# Readme' });

    let fetched = await consumerAccessListingService.getById({
      consumerSurface: surface,
      consumerAccessListingId: listing.id
    });
    expect(fetched.description).toBe('Updated by e2e');
  });

  it('filters listings by target and type', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let server = await createMagicServer(fixture);
    let skill = await createSkill(fixture);

    let serverListing = await consumerAccessListingService.create({
      consumerSurface: surface,
      auditScope: fixture.auditScope,
      input: { access: { type: 'magic_mcp_server', magicMcpServerId: server.id } }
    });
    let skillListing = await consumerAccessListingService.create({
      consumerSurface: surface,
      auditScope: fixture.auditScope,
      input: { access: { type: 'skill', skillId: skill.id } }
    });

    let list = async (
      filters: Omit<Parameters<typeof consumerAccessListingService.list>[0], 'consumerSurface'>
    ) =>
      (
        await firstPage(
          await consumerAccessListingService.list({ consumerSurface: surface, ...filters })
        )
      )
        .map(item => item.id)
        .sort();

    expect(await list({})).toEqual([serverListing.id, skillListing.id].sort());
    expect(await list({ types: ['magic_mcp_server'] })).toEqual([serverListing.id]);
    expect(await list({ types: ['skill', 'magic_mcp_server'] })).toEqual(
      [serverListing.id, skillListing.id].sort()
    );
    expect(await list({ skillIds: [skill.id] })).toEqual([skillListing.id]);
    expect(await list({ magicMcpServerIds: [server.id] })).toEqual([serverListing.id]);
    expect(await list({ magicMcpServerIds: [uniqueId('mms')] })).toEqual([]);
  });

  it('rejects unknown, archived and foreign targets', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createSurface(fixture);
    let archived = await archiveMagicServer(fixture, await createMagicServer(fixture));
    let foreignServer = await createMagicServer(other);
    let foreignSkill = await createSkill(other);
    let create = (
      access: Parameters<typeof consumerAccessListingService.create>[0]['input']['access']
    ) =>
      consumerAccessListingService.create({
        consumerSurface: surface,
        auditScope: fixture.auditScope,
        input: { access }
      });

    await expectServiceError(
      create({ type: 'magic_mcp_server', magicMcpServerId: uniqueId('mms') }),
      'not_found'
    );
    await expectServiceError(
      create({ type: 'magic_mcp_server', magicMcpServerId: archived.id }),
      'not_found'
    );
    await expectServiceError(
      create({ type: 'magic_mcp_server', magicMcpServerId: foreignServer.id }),
      'not_found'
    );
    await expectServiceError(create({ type: 'skill', skillId: foreignSkill.id }), 'not_found');
    await expectServiceError(
      create({ type: 'provider_template', providerTemplateId: uniqueId('pt') }),
      'not_found'
    );

    expect(await db.consumerAccessListing.count({ where: { surfaceOid: surface.oid } })).toBe(
      0
    );
  });

  it('deletes a listing together with its accesses and their grants', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let otherGroup = await createGroup(fixture, surface);
    let profile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);
    await addToGroups(fixture, profile, [group.id]);

    let accesses = [];
    for (let consumerGroup of [group, otherGroup]) {
      accesses.push(
        await consumerAccessService.createConsumerAccess({
          organization: fixture.organization,
          consumerSurface: surface,
          consumerGroup,
          auditScope: fixture.auditScope,
          access: { type: 'magic_mcp_server', magicMcpServer: server }
        })
      );
    }
    expect(await canReadMagicServer(server, await accessTagsFor(profile))).toBe(true);

    let listing = await consumerAccessListingService.getById({
      consumerSurface: surface,
      consumerAccessListingId: accesses[0]!.listing!.id
    });
    let deleted = await consumerAccessListingService.delete({
      organization: fixture.organization,
      consumerAccessListing: listing,
      auditScope: fixture.auditScope
    });
    expect(deleted.id).toBe(listing.id);

    expect(
      await db.consumerAccessListing.findUnique({ where: { id: listing.id } })
    ).toBeNull();
    expect(
      await db.consumerAccess.count({ where: { id: { in: accesses.map(item => item.id) } } })
    ).toBe(0);
    for (let consumerGroup of [group, otherGroup]) {
      expect(
        await countGrants({
          accessTagOid: consumerGroup.accessTagOid,
          magicMcpServerOid: server.oid
        })
      ).toBe(0);
    }
    expect(await canReadMagicServer(server, await accessTagsFor(profile))).toBe(false);

    let again = await consumerAccessListingService.delete({
      organization: fixture.organization,
      consumerAccessListing: listing,
      auditScope: fixture.auditScope
    });
    expect(again.id).toBe(listing.id);
  });

  it('does not resolve or list listings of another surface or organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createSurface(fixture);
    let siblingSurface = await createSurface(fixture);
    let foreignSurface = await createSurface(other);
    let server = await createMagicServer(fixture);

    let listing = await consumerAccessListingService.create({
      consumerSurface: surface,
      auditScope: fixture.auditScope,
      input: { access: { type: 'magic_mcp_server', magicMcpServerId: server.id } }
    });

    for (let consumerSurface of [siblingSurface, foreignSurface]) {
      await expectServiceError(
        consumerAccessListingService.getById({
          consumerSurface,
          consumerAccessListingId: listing.id
        }),
        'not_found'
      );

      let listed = await firstPage(
        await consumerAccessListingService.list({ consumerSurface })
      );
      expect(listed.map(item => item.id)).not.toContain(listing.id);
    }

    await expectServiceError(
      consumerAccessListingService.create({
        consumerSurface: foreignSurface,
        auditScope: other.auditScope,
        input: { access: { type: 'magic_mcp_server', magicMcpServerId: server.id } }
      }),
      'not_found'
    );
  });
});
