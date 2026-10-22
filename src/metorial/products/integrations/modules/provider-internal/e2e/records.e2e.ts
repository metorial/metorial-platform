import {
  createRemoteProvider,
  eventually,
  uniqueId,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { subDays } from 'date-fns';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { providerInternalService, providerVersionInternalService } from '../src';
import { cleanupCron } from '../src/cron/cleanup';
import { loadCurrentVersion, loadProvider, scopeOf, toolKeys, triggerCron } from './_fixtures';

describe('module-provider-internal provider records of a remote server', () => {
  let org = useOrganization();
  let server = useMcpTestServer();
  let remote = useFixture(() =>
    createRemoteProvider(org.clients.instance, { url: server.url })
  );

  let workers: { close: () => any } | undefined | void;

  beforeAll(async () => {
    workers = await cleanupCron.start();
  });

  afterAll(async () => {
    await workers?.close();
  });

  let loadListing = (providerOid: bigint) =>
    subspaceDb.providerListing.findUniqueOrThrow({ where: { providerOid } });

  let resync = async (input: { name?: string } = {}) => {
    let { tenant } = await scopeOf(org);
    let provider = await loadProvider(remote.providerId);
    let variant = provider.defaultVariant!;

    return await providerInternalService.upsertProvider({
      owner: { tenant },
      publisher: provider.publisher,
      source: {
        type: 'shuttle',
        shuttleServer: variant.shuttleServer!,
        backend: variant.backend
      },
      info: {
        name: input.name ?? provider.name,
        description: provider.description ?? undefined,
        slug: provider.slug,
        globalIdentifier: null,
        keepExistingImage: true
      },
      type: { name: provider.type.name, attributes: provider.type.attributes }
    });
  };

  it('creates a tenant-owned provider with a default variant, a current version and a private listing', async () => {
    let { tenant } = await scopeOf(org);
    let provider = await loadProvider(remote.providerId);
    let variant = provider.defaultVariant!;
    let base = `provider::shuttle::${variant.shuttleServerOid}`;

    expect(provider).toMatchObject({
      identifier: `${base}::provider`,
      access: 'tenant',
      status: 'active',
      ownerTenantOid: tenant.oid
    });
    expect(provider.entry.identifier).toBe(`${base}::entry`);
    expect(provider.publisher).toMatchObject({
      type: 'tenant',
      identifier: `tenant::${tenant.id}`,
      tenantOid: tenant.oid
    });
    expect(provider.type.attributes).toMatchObject({
      provider: 'metorial-shuttle',
      backend: 'mcp.remote'
    });

    expect(variant).toMatchObject({
      identifier: `${base}::variant`,
      isDefault: true,
      providerOid: provider.oid,
      publisherOid: provider.publisherOid
    });

    let version = await loadCurrentVersion(remote.providerId);
    expect(version).toMatchObject({
      identifier: `${base}::${version.shuttleServerVersionOid}`,
      isCurrent: true,
      providerOid: provider.oid,
      providerVariantOid: variant.oid,
      shuttleServerOid: variant.shuttleServerOid
    });

    let listing = await loadListing(provider.oid);
    expect(listing).toMatchObject({
      status: 'active',
      isPublic: false,
      ownerTenantOid: tenant.oid,
      publisherOid: provider.publisherOid,
      typeOid: provider.typeOid
    });
  });

  it('gives the version a preliminary specification without tools before any connection', async () => {
    let version = await eventually(async () => {
      let version = await loadCurrentVersion(remote.providerId);
      expect(version.specificationDiscoveryStatus).toBe('discovered');
      return version;
    });

    expect(version.specification).toMatchObject({
      type: 'preliminary',
      providerOid: version.providerOid
    });
    expect(version.specification!.specId).toMatch(/::preliminary$/);
    expect(toolKeys(version.specification)).toEqual([]);
  });

  it('re-syncing the same shuttle server updates the existing rows, also concurrently', async () => {
    let before = await loadProvider(remote.providerId);
    let listingBefore = await loadListing(before.oid);

    let results = await Promise.all([resync(), resync(), resync()]);
    for (let result of results) {
      expect(result.id).toBe(before.id);
      expect(result.defaultVariant?.id).toBe(before.defaultVariant!.id);
    }

    expect(await subspaceDb.provider.count({ where: { identifier: before.identifier } })).toBe(
      1
    );
    expect(
      await subspaceDb.providerEntry.count({ where: { identifier: before.entry.identifier } })
    ).toBe(1);
    expect(
      await subspaceDb.providerVariant.count({ where: { providerOid: before.oid } })
    ).toBe(1);
    expect(
      await subspaceDb.providerListing.count({ where: { providerOid: before.oid } })
    ).toBe(1);

    let listing = await loadListing(before.oid);
    expect(listing).toMatchObject({ id: listingBefore.id, slug: listingBefore.slug });
  });

  it('re-upserting the current version keeps a single current version and its specification', async () => {
    let provider = await loadProvider(remote.providerId);
    let variant = provider.defaultVariant!;
    let version = await loadCurrentVersion(remote.providerId);

    let again = await providerVersionInternalService.upsertVersion({
      variant,
      isCurrent: true,
      source: {
        type: 'shuttle',
        shuttleServer: variant.shuttleServer!,
        shuttleServerVersion: version.shuttleServerVersion!,
        backend: variant.backend
      },
      info: { name: version.name },
      type: { name: provider.type.name, attributes: provider.type.attributes }
    });

    expect(again).toMatchObject({
      id: version.id,
      isCurrent: true,
      typeOid: version.typeOid,
      previousVersionOid: version.previousVersionOid,
      specificationOid: version.specificationOid
    });
    expect(
      await subspaceDb.providerVersion.count({ where: { identifier: version.identifier } })
    ).toBe(1);
    expect(
      await subspaceDb.providerVersion.count({
        where: { providerVariantOid: variant.oid, isCurrent: true }
      })
    ).toBe(1);

    let reloaded = await loadProvider(remote.providerId);
    expect(reloaded.defaultVariant!.currentVersionOid).toBe(version.oid);
  });

  it('records a listing update and keeps curated listing fields when the provider re-syncs', async () => {
    let provider = await loadProvider(remote.providerId);
    let listingBefore = await loadListing(provider.oid);
    let syncedName = provider.name;
    let curatedName = uniqueId('Curated');

    await providerInternalService.updateProvider({
      provider,
      input: { name: curatedName, readme: '# Curated', skills: ['e2e'] }
    });

    let listing = await loadListing(provider.oid);
    expect(listing).toMatchObject({
      isCustomized: true,
      name: curatedName,
      readme: '# Curated',
      skills: ['e2e']
    });

    let update = await subspaceDb.providerListingUpdate.findFirstOrThrow({
      where: { providerListingOid: listing.oid },
      orderBy: { oid: 'desc' }
    });
    expect(update.before).toMatchObject({ id: listing.id, name: listingBefore.name });
    expect(update.after).toMatchObject({
      id: listing.id,
      name: curatedName,
      readme: '# Curated',
      isCustomized: true
    });

    await resync({ name: syncedName });

    let resynced = await loadProvider(remote.providerId);
    expect(resynced.name).toBe(syncedName);
    expect(await loadListing(provider.oid)).toMatchObject({
      isCustomized: true,
      name: curatedName,
      readme: '# Curated'
    });
  });

  it('keeps a deprecated provider deprecated across a re-sync', async () => {
    let provider = await loadProvider(remote.providerId);

    let deprecated = await providerInternalService.deprecateProvider({ provider });
    expect(deprecated.isDeprecated).toBe(true);
    expect((await loadListing(provider.oid)).isDeprecated).toBe(true);

    await resync();

    expect((await loadProvider(remote.providerId)).isDeprecated).toBe(true);
    expect((await loadListing(provider.oid)).isDeprecated).toBe(true);
  });

  it('the cleanup cron deletes listing updates older than 30 days and keeps recent ones', async () => {
    let provider = await loadProvider(remote.providerId);

    await providerInternalService.updateProvider({ provider, input: { rank: 1 } });
    await providerInternalService.updateProvider({ provider, input: { rank: 2 } });

    let listing = await loadListing(provider.oid);
    let [recent, stale] = await subspaceDb.providerListingUpdate.findMany({
      where: { providerListingOid: listing.oid },
      orderBy: { oid: 'desc' },
      take: 2
    });

    await subspaceDb.providerListingUpdate.update({
      where: { oid: stale!.oid },
      data: { createdAt: subDays(new Date(), 31) }
    });

    await triggerCron('sub/pint/cleanup');

    await eventually(async () => {
      expect(
        await subspaceDb.providerListingUpdate.findUnique({ where: { oid: stale!.oid } })
      ).toBeNull();
    });
    expect(
      await subspaceDb.providerListingUpdate.findUnique({ where: { oid: recent!.oid } })
    ).not.toBeNull();
  });
});
