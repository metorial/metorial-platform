import { expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import type { ConsumerSurface } from '@metorial/db';
import {
  consumerAccessListingService,
  consumerAccessRequestService
} from '@metorial/module-consumer-access';
import { magicMcpServerService } from '@metorial/module-magic';
import { describe, expect, it } from 'vitest';
import { consumerProviderCatalogService } from '../src';
import {
  addToGroups,
  consumerView,
  createGroup,
  createMagicServer,
  createProfile,
  createSurface,
  grantMagicServer
} from './_fixtures';

describe('module-consumer-entities provider catalog', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let listCatalog = async (
    fixture: Awaited<ReturnType<typeof loadOrganizationFixture>>,
    consumerSurface: ConsumerSurface,
    consumerProfile: Awaited<ReturnType<typeof createProfile>>,
    pagination?: { limit?: number; after?: string }
  ) =>
    await consumerProviderCatalogService.listCatalogEntries({
      instance: fixture.instance,
      consumerSurface,
      consumerProfile,
      ...(await consumerView(consumerProfile)),
      pagination
    });

  let getItem = async (
    fixture: Awaited<ReturnType<typeof loadOrganizationFixture>>,
    consumerSurface: ConsumerSurface,
    consumerProfile: Awaited<ReturnType<typeof createProfile>>,
    catalogItemId: string
  ) =>
    await consumerProviderCatalogService.getCatalogItem({
      instance: fixture.instance,
      consumerSurface,
      consumerProfile,
      ...(await consumerView(consumerProfile)),
      catalogItemId
    });

  it('shows every listing of the surface with availability per consumer', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let otherGroup = await createGroup(fixture, surface);
    let member = await createProfile(fixture, surface);
    let outsider = await createProfile(fixture, surface);
    await addToGroups(fixture, member, [group.id]);

    let granted = await createMagicServer(fixture, { name: uniqueId('A granted') });
    let listedOnly = await createMagicServer(fixture, { name: uniqueId('B listed') });
    let access = await grantMagicServer(fixture, surface, group, granted);
    let otherAccess = await grantMagicServer(fixture, surface, otherGroup, granted);
    let listing = await consumerAccessListingService.create({
      consumerSurface: surface,
      auditScope: fixture.auditScope,
      input: { access: { type: 'magic_mcp_server', magicMcpServerId: listedOnly.id } }
    });

    let memberCatalog = await listCatalog(fixture, surface, member);
    expect(memberCatalog.items.map(item => item.id)).toEqual([access.listing!.id, listing.id]);

    let [grantedEntry, listedEntry] = memberCatalog.items;
    expect(grantedEntry).toMatchObject({
      type: 'magic_mcp_server',
      name: granted.name,
      description: granted.description,
      availability: 'available_now',
      hasPendingAccessRequest: false,
      consumerAccessIds: [access.id],
      magicMcpServerId: granted.id,
      providerTemplateId: null
    });
    expect(grantedEntry!.consumerAccessIds).not.toContain(otherAccess.id);
    expect(listedEntry).toMatchObject({
      availability: 'request_access',
      consumerAccessIds: [],
      magicMcpServerId: listedOnly.id
    });

    let outsiderCatalog = await listCatalog(fixture, surface, outsider);
    expect(outsiderCatalog.items.map(item => [item.id, item.availability])).toEqual([
      [access.listing!.id, 'request_access'],
      [listing.id, 'request_access']
    ]);
    expect(outsiderCatalog.items.flatMap(item => item.consumerAccessIds)).toEqual([]);
  });

  it('flags a pending access request only for the requesting consumer', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let requester = await createProfile(fixture, surface);
    let bystander = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);
    let listing = await consumerAccessListingService.create({
      consumerSurface: surface,
      auditScope: fixture.auditScope,
      input: { access: { type: 'magic_mcp_server', magicMcpServerId: server.id } }
    });

    let request = await consumerAccessRequestService.createConsumerAccessRequest({
      consumerProfile: requester,
      accessRequest: { type: 'magic_mcp_server', magicMcpServer: server },
      auditScope: fixture.auditScope
    });

    expect(
      (await getItem(fixture, surface, requester, listing.id)).hasPendingAccessRequest
    ).toBe(true);
    expect(
      (await getItem(fixture, surface, bystander, listing.id)).hasPendingAccessRequest
    ).toBe(false);

    await consumerAccessRequestService.reviewConsumerAccessRequest({
      organization: fixture.organization,
      consumerAccessRequest: request,
      auditScope: fixture.auditScope,
      input: { status: 'rejected' }
    });
    expect(
      (await getItem(fixture, surface, requester, listing.id)).hasPendingAccessRequest
    ).toBe(false);
  });

  it('resolves an entry by listing, access or server id and hides archived servers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let member = await createProfile(fixture, surface);
    await addToGroups(fixture, member, [group.id]);
    let server = await createMagicServer(fixture);
    let access = await grantMagicServer(fixture, surface, group, server);
    let listingId = access.listing!.id;

    for (let catalogItemId of [listingId, access.id, server.id]) {
      let item = await getItem(fixture, surface, member, catalogItemId);
      expect(item).toMatchObject({ id: listingId, availability: 'available_now' });

      let entry = await consumerProviderCatalogService.getCatalogEntry({
        instance: fixture.instance,
        consumerSurface: surface,
        consumerProfile: member,
        ...(await consumerView(member)),
        catalogItemId
      });
      expect(entry.id).toBe(listingId);
    }

    await expectServiceError(getItem(fixture, surface, member, uniqueId('cal')), 'not_found');

    await magicMcpServerService.archiveMagicMcpServer({
      server,
      auditScope: fixture.auditScope
    });

    await expectServiceError(getItem(fixture, surface, member, listingId), 'not_found');
    expect((await listCatalog(fixture, surface, member)).items).toEqual([]);
  });

  it('never shows listings of another surface or organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createSurface(fixture);
    let siblingSurface = await createSurface(fixture);
    let foreignSurface = await createSurface(other);
    let member = await createProfile(fixture, surface);
    let siblingMember = await createProfile(fixture, siblingSurface);
    let foreignMember = await createProfile(other, foreignSurface);
    let server = await createMagicServer(fixture);

    let access = await grantMagicServer(
      fixture,
      siblingSurface,
      siblingMember.personalConsumerGroup!,
      server
    );
    let foreignServer = await createMagicServer(other);
    let foreignAccess = await grantMagicServer(
      other,
      foreignSurface,
      foreignMember.personalConsumerGroup!,
      foreignServer
    );

    expect((await listCatalog(fixture, surface, member)).items).toEqual([]);
    for (let catalogItemId of [access.listing!.id, access.id, server.id]) {
      await expectServiceError(getItem(fixture, surface, member, catalogItemId), 'not_found');
    }
    for (let catalogItemId of [
      foreignAccess.listing!.id,
      foreignAccess.id,
      foreignServer.id
    ]) {
      await expectServiceError(getItem(fixture, surface, member, catalogItemId), 'not_found');
    }

    let siblingCatalog = await listCatalog(fixture, siblingSurface, siblingMember);
    expect(siblingCatalog.items.map(item => [item.id, item.availability])).toEqual([
      [access.listing!.id, 'available_now']
    ]);
  });

  it('pages through the catalog in name order', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let member = await createProfile(fixture, surface);
    let prefix = uniqueId('Paged');

    let listingIds: string[] = [];
    for (let suffix of ['a', 'b', 'c']) {
      let server = await createMagicServer(fixture, { name: `${prefix} ${suffix}` });
      let listing = await consumerAccessListingService.create({
        consumerSurface: surface,
        auditScope: fixture.auditScope,
        input: { access: { type: 'magic_mcp_server', magicMcpServerId: server.id } }
      });
      listingIds.push(listing.id);
    }

    let first = await listCatalog(fixture, surface, member, { limit: 2 });
    expect(first.items.map(item => item.id)).toEqual(listingIds.slice(0, 2));
    expect(first.pagination).toMatchObject({ hasNextPage: true, hasPreviousPage: false });

    let second = await listCatalog(fixture, surface, member, {
      limit: 2,
      after: first.items[1]!.id
    });
    expect(second.items.map(item => item.id)).toEqual(listingIds.slice(2));
    expect(second.pagination).toMatchObject({ hasNextPage: false, hasPreviousPage: true });

    let featured = await consumerProviderCatalogService.listFeaturedCatalogItems({
      instance: fixture.instance,
      consumerSurface: surface,
      consumerProfile: member,
      ...(await consumerView(member)),
      limit: 2
    });
    expect(featured.map(item => item.id)).toEqual(listingIds.slice(0, 2));
  });
});
