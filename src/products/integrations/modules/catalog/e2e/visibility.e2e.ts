import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { subspaceScopeService } from '@metorial-subspace/module-tenant';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  providerListingService,
  providerService,
  providerSpecificationService,
  providerToolService,
  providerVariantService,
  providerVersionService,
  providerTypeService,
  publisherService
} from '../src';
import {
  type CatalogProvider,
  catalogTools,
  deployCatalogProvider,
  pageIds
} from './_fixtures';

type Fixture = Awaited<ReturnType<typeof loadOrganizationFixture>>;

let ids = (items: { id: string }[]) => items.map(item => item.id);

describe('module-catalog provider visibility', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer({ tools: catalogTools });

  let deployed: CatalogProvider;
  let mine: Fixture;
  let theirs: Fixture;

  beforeAll(async () => {
    deployed = await deployCatalogProvider(org, server.url);
    mine = await loadOrganizationFixture(org.ids);
    theirs = await loadOrganizationFixture(otherOrg.ids);
  }, 180_000);

  it('publishes a newly deployed remote provider with its version, specification and tools', async () => {
    let { instance } = mine;
    let { tenant } = await subspaceScopeService.ensureForInstance(instance);

    let provider = await providerService.getProviderById({
      instance,
      providerId: deployed.provider.id
    });
    expect(provider).toMatchObject({
      id: deployed.provider.id,
      access: 'tenant',
      status: 'active',
      isDeprecated: false,
      ownerTenantOid: tenant.oid
    });
    expect(provider.publisher).toMatchObject({ type: 'tenant', tenantOid: tenant.oid });
    expect(provider.defaultVariant?.currentVersion?.id).toBe(deployed.version.id);

    let bySlug = await providerService.getProviderById({
      instance,
      providerId: deployed.listing.slug
    });
    expect(bySlug.id).toBe(provider.id);

    let listing = await providerListingService.getProviderListingById({
      instance,
      providerListingId: deployed.listing.id
    });
    expect(listing).toMatchObject({
      providerOid: provider.oid,
      ownerTenantOid: tenant.oid,
      isPublic: false,
      name: provider.name
    });
    expect(
      (
        await providerListingService.getProviderListingById({
          instance,
          providerListingId: provider.id
        })
      ).id
    ).toBe(listing.id);

    let version = await providerVersionService.getProviderVersionById({
      instance,
      providerVersionId: deployed.version.id
    });
    expect(version).toMatchObject({ providerOid: provider.oid, isEnvironmentLocked: true });
    expect(version.specification?.oid).toBe(deployed.version.specificationOid);

    let specification = await providerSpecificationService.getProviderSpecificationById({
      instance,
      providerSpecificationId: version.specification!.id
    });
    expect(specification.providerTools.map(tool => tool.name)).toEqual(
      expect.arrayContaining(catalogTools.map(tool => tool.name))
    );

    let tools = await firstPage(
      await providerToolService.listProviderTools({ instance, providerVersion: version })
    );
    expect(tools.map(tool => ({ name: tool.name, description: tool.description }))).toEqual(
      expect.arrayContaining(
        catalogTools.map(tool => ({ name: tool.name, description: tool.description }))
      )
    );
    expect(ids(tools).sort()).toEqual(ids(deployed.tools).sort());
    for (let tool of tools) expect(tool.specificationOid).toBe(specification.oid);

    let tool = await providerToolService.getProviderToolById({
      instance,
      providerToolId: tools[0]!.id
    });
    expect(tool).toMatchObject({ id: tools[0]!.id, providerOid: provider.oid });

    let variant = await providerVariantService.getProviderVariantById({
      instance,
      provider,
      providerVariantId: provider.defaultVariant!.id
    });
    expect(variant.currentVersion?.id).toBe(version.id);

    let publisher = await publisherService.getPublisherById({
      instance,
      publisherId: provider.publisher.id
    });
    expect(publisher.id).toBe(provider.publisher.id);
  });

  it("hides a tenant's provider from every lookup of another tenant", async () => {
    let { instance } = theirs;
    let provider = deployed.provider;
    let tool = deployed.tools[0]!;

    await expectServiceError(
      providerService.getProviderById({ instance, providerId: provider.id }),
      'not_found'
    );
    await expectServiceError(
      providerService.getProviderById({ instance, providerId: deployed.listing.slug }),
      'not_found'
    );
    await expectServiceError(
      providerListingService.getProviderListingById({
        instance,
        providerListingId: deployed.listing.id
      }),
      'not_found'
    );
    await expectServiceError(
      providerListingService.getProviderListingById({
        instance,
        providerListingId: provider.id
      }),
      'not_found'
    );
    await expectServiceError(
      providerVersionService.getProviderVersionById({
        instance,
        providerVersionId: deployed.version.id
      }),
      'not_found'
    );
    await expectServiceError(
      providerToolService.getProviderToolById({ instance, providerToolId: tool.id }),
      'not_found'
    );
    await expectServiceError(
      providerVariantService.getProviderVariantById({
        instance,
        providerVariantId: provider.defaultVariant!.id
      }),
      'not_found'
    );
    await expectServiceError(
      publisherService.getPublisherById({ instance, publisherId: provider.publisher.id }),
      'not_found'
    );

    let specification = await providerSpecificationService.getProviderSpecificationById({
      instance: mine.instance,
      providerSpecificationId: tool.specification.id
    });
    let notFound = await expectServiceError(
      providerSpecificationService.getProviderSpecificationById({
        instance,
        providerSpecificationId: specification.id
      }),
      'not_found'
    );
    expect(notFound.message).toMatch(/specification/);

    expect(
      await firstPage(await providerService.listProviders({ instance, ids: [provider.id] }))
    ).toEqual([]);
    expect(
      await firstPage(
        await providerListingService.listProviderListings({
          instance,
          ids: [deployed.listing.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await providerVersionService.listProviderVersions({
          instance,
          providerIds: [provider.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await providerVersionService.listProviderVersions({
          instance,
          ids: [deployed.version.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await providerSpecificationService.listProviderSpecifications({
          instance,
          ids: [specification.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await providerToolService.listProviderTools({
          instance,
          providerVersion: deployed.version
        })
      )
    ).toEqual([]);
    expect(
      ids(await firstPage(await providerVariantService.listProviderVariants({ instance })))
    ).not.toContain(provider.defaultVariant!.id);
    expect(
      ids(await firstPage(await publisherService.listPublishers({ instance })))
    ).not.toContain(provider.publisher.id);
  });

  it("lists only the tenant's own listings with onlyFromTenant", async () => {
    let owned = await firstPage(
      await providerListingService.listProviderListings({
        instance: mine.instance,
        onlyFromTenant: true
      })
    );
    expect(ids(owned)).toEqual([deployed.listing.id]);
    expect(owned[0]!.provider.id).toBe(deployed.provider.id);

    expect(
      await firstPage(
        await providerListingService.listProviderListings({
          instance: theirs.instance,
          onlyFromTenant: true
        })
      )
    ).toEqual([]);
  });

  it('matches nothing for empty or unknown id filters', async () => {
    let { instance } = mine;

    expect(
      await firstPage(await providerService.listProviders({ instance, ids: [] }))
    ).toEqual([]);
    expect(
      await firstPage(await providerListingService.listProviderListings({ instance, ids: [] }))
    ).toEqual([]);
    expect(
      await firstPage(await providerVersionService.listProviderVersions({ instance, ids: [] }))
    ).toEqual([]);
    expect(
      await firstPage(
        await providerVersionService.listProviderVersions({ instance, providerIds: [] })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await providerVersionService.listProviderVersions({
          instance,
          providerIds: [uniqueId('pro')]
        })
      )
    ).toEqual([]);

    for (let filter of [
      { providerVersionIds: [] },
      { providerVersionIds: [uniqueId('pver')] },
      { providerDeploymentIds: [uniqueId('pdep')] },
      { providerConfigIds: [uniqueId('pcfg')] }
    ]) {
      expect(
        await firstPage(
          await providerSpecificationService.listProviderSpecifications({
            instance,
            ...filter
          })
        )
      ).toEqual([]);
    }

    let byVersion = await firstPage(
      await providerSpecificationService.listProviderSpecifications({
        instance,
        providerVersionIds: [deployed.version.id]
      })
    );
    expect(byVersion.map(specification => specification.oid)).toEqual([
      deployed.version.specificationOid
    ]);
    expect(byVersion[0]!.providerTools.map(tool => tool.name).sort()).toEqual(
      deployed.tools.map(tool => tool.name).sort()
    );
  });

  it('pages through the tools of a version one at a time in both directions', async () => {
    let { instance } = mine;
    let list = () =>
      providerToolService.listProviderTools({ instance, providerVersion: deployed.version });

    let pages = await pageIds(await list());
    expect(pages).toHaveLength(deployed.tools.length);
    expect(pages.every(page => page.length === 1)).toBe(true);
    expect(new Set(pages.flat())).toEqual(new Set(ids(deployed.tools)));

    let ascending = ids((await (await list()).run({ limit: 100, order: 'asc' })).items);
    let descending = ids((await (await list()).run({ limit: 100, order: 'desc' })).items);
    expect(descending).toEqual([...ascending].reverse());
  });

  it('filters providers by capability and listings by creation date', async () => {
    let { instance } = mine;
    let type = deployed.provider.type;

    let matching = await firstPage(
      await providerService.listProviders({
        instance,
        capabilities: { supportsConfig: type.supportsConfig, supportsAuth: type.supportsAuth }
      })
    );
    expect(ids(matching)).toContain(deployed.provider.id);

    let opposite = await firstPage(
      await providerService.listProviders({
        instance,
        capabilities: { supportsConfig: !type.supportsConfig }
      })
    );
    expect(ids(opposite)).not.toContain(deployed.provider.id);

    let createdAt = deployed.listing.createdAt.getTime();
    let after = await firstPage(
      await providerListingService.listProviderListings({
        instance,
        onlyFromTenant: true,
        createdAt: { gt: new Date(createdAt - 60_000) }
      })
    );
    expect(ids(after)).toEqual([deployed.listing.id]);

    let before = await firstPage(
      await providerListingService.listProviderListings({
        instance,
        onlyFromTenant: true,
        createdAt: { lt: new Date(createdAt - 60_000) }
      })
    );
    expect(before).toEqual([]);
  });

  it('resolves and lists provider types', async () => {
    let type = deployed.provider.type;

    let fetched = await providerTypeService.getProviderTypeById({ providerTypeId: type.id });
    expect(fetched).toMatchObject({ id: type.id, identifier: type.identifier });

    let listed = await firstPage(
      await providerTypeService.listProviderTypes({ ids: [type.id] })
    );
    expect(ids(listed)).toEqual([type.id]);

    await expectServiceError(
      providerTypeService.getProviderTypeById({ providerTypeId: uniqueId('ptyp') }),
      'not_found'
    );
  });

  it('filters listings by publisher', async () => {
    let listings = await firstPage(
      await providerListingService.listProviderListings({
        instance: mine.instance,
        publisherIds: [deployed.provider.publisher.id]
      })
    );
    expect(ids(listings)).toContain(deployed.listing.id);

    let unmatched = await firstPage(
      await providerListingService.listProviderListings({
        instance: mine.instance,
        publisherIds: [deployed.provider.id]
      })
    );
    expect(ids(unmatched)).toEqual([]);
  });

  it('finds a newly deployed listing by search for its owner only', async () => {
    await eventually(
      async () => {
        let found = await firstPage(
          await providerListingService.listProviderListings({
            instance: mine.instance,
            search: deployed.name
          })
        );
        expect(ids(found)).toContain(deployed.listing.id);

        let providers = await firstPage(
          await providerService.listProviders({
            instance: mine.instance,
            search: deployed.name
          })
        );
        expect(ids(providers)).toContain(deployed.provider.id);
      },
      { timeoutMs: 90_000, intervalMs: 1_000 }
    );

    let foreign = await firstPage(
      await providerListingService.listProviderListings({
        instance: theirs.instance,
        search: deployed.name
      })
    );
    expect(ids(foreign)).not.toContain(deployed.listing.id);
  }, 120_000);
});
