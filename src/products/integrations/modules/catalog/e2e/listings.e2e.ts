import {
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  providerListingCategoryService,
  providerListingCollectionService,
  providerListingGroupService,
  providerListingService
} from '../src';
import { type CatalogProvider, catalogTools, deployCatalogProvider } from './_fixtures';

type Fixture = Awaited<ReturnType<typeof loadOrganizationFixture>>;

let ids = (items: { id: string }[]) => items.map(item => item.id);

describe('module-catalog listing categories, collections and groups', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer({ tools: catalogTools });

  let deployed: CatalogProvider;
  let mine: Fixture;
  let theirs: Fixture;

  let loadListing = () =>
    providerListingService.getProviderListingById({
      instance: mine.instance,
      providerListingId: deployed.listing.id
    });

  beforeAll(async () => {
    deployed = await deployCatalogProvider(org, server.url);
    mine = await loadOrganizationFixture(org.ids);
    theirs = await loadOrganizationFixture(otherOrg.ids);
  }, 180_000);

  it('filters listings and categories by category', async () => {
    let { instance } = mine;

    let seeded = await firstPage(
      await providerListingCategoryService.listProviderListingCategories({ instance })
    );
    expect(seeded.map(category => category.slug)).toEqual(
      expect.arrayContaining(['web-search', 'security'])
    );

    let slug = uniqueId('e2e-category');
    let category = await providerListingCategoryService.upsertProviderListingCategory({
      input: { name: 'E2E category', slug, description: 'Created by the catalog e2e suite' }
    });
    let again = await providerListingCategoryService.upsertProviderListingCategory({
      input: { name: 'E2E category renamed', slug, description: 'Updated' }
    });
    expect(again).toMatchObject({ id: category.id, name: 'E2E category renamed' });
    expect(
      (
        await providerListingCategoryService.getProviderListingCategoryById({
          instance,
          providerListingCategoryId: slug
        })
      ).id
    ).toBe(category.id);

    await subspaceDb.providerListing.update({
      where: { oid: deployed.listing.oid },
      data: { categories: { connect: { oid: category.oid } } }
    });

    expect((await loadListing()).categories.map(item => item.id)).toEqual([category.id]);
    for (let filter of [category.id, slug]) {
      expect(
        ids(
          await firstPage(
            await providerListingService.listProviderListings({
              instance,
              providerCategoryIds: [filter]
            })
          )
        )
      ).toEqual([deployed.listing.id]);
    }
    expect(
      await firstPage(
        await providerListingService.listProviderListings({
          instance,
          providerCategoryIds: [uniqueId('missing-category')]
        })
      )
    ).toEqual([]);

    expect(
      ids(
        await firstPage(
          await providerListingCategoryService.listProviderListingCategories({
            instance,
            providerIds: [deployed.provider.id]
          })
        )
      )
    ).toEqual([category.id]);
    expect(
      ids(
        await firstPage(
          await providerListingCategoryService.listProviderListingCategories({
            instance,
            providerListingIds: [deployed.listing.id]
          })
        )
      )
    ).toEqual([category.id]);

    expect(
      await firstPage(
        await providerListingCategoryService.listProviderListingCategories({
          instance: theirs.instance,
          providerIds: [deployed.provider.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await providerListingService.listProviderListings({
          instance: theirs.instance,
          providerCategoryIds: [category.id]
        })
      )
    ).toEqual([]);
  });

  it('filters listings and collections by collection', async () => {
    let { instance } = mine;
    let slug = uniqueId('e2e-collection');

    let collection = await providerListingCollectionService.upsertProviderListingCollection({
      input: { name: 'E2E collection', slug, description: 'Created by the catalog e2e suite' }
    });
    let again = await providerListingCollectionService.upsertProviderListingCollection({
      input: { name: 'E2E collection renamed', slug, description: '' }
    });
    expect(again).toMatchObject({
      id: collection.id,
      name: 'E2E collection renamed',
      description: 'Created by the catalog e2e suite'
    });

    expect(
      (
        await providerListingCollectionService.getProviderListingCollectionById({
          instance,
          providerListingCollectionId: slug
        })
      ).id
    ).toBe(collection.id);
    await expectServiceError(
      providerListingCollectionService.getProviderListingCollectionById({
        instance,
        providerListingCollectionId: uniqueId('missing-collection')
      }),
      'not_found'
    );

    await subspaceDb.providerListing.update({
      where: { oid: deployed.listing.oid },
      data: { collections: { connect: { oid: collection.oid } } }
    });

    expect((await loadListing()).collections.map(item => item.id)).toEqual([collection.id]);
    expect(
      ids(
        await firstPage(
          await providerListingService.listProviderListings({
            instance,
            providerCollectionIds: [slug]
          })
        )
      )
    ).toEqual([deployed.listing.id]);
    expect(
      ids(
        await firstPage(
          await providerListingCollectionService.listProviderListingCollections({
            instance,
            providerListingIds: [deployed.listing.id]
          })
        )
      )
    ).toEqual([collection.id]);
    expect(
      await firstPage(
        await providerListingCollectionService.listProviderListingCollections({
          instance: theirs.instance,
          providerListingIds: [deployed.listing.id]
        })
      )
    ).toEqual([]);
  });

  it('adds listings to tenant groups and filters by group', async () => {
    let { instance, actor, auditScope } = mine;

    let group = await providerListingGroupService.createProviderListingGroup({
      instance,
      organizationActor: actor,
      auditScope,
      input: { name: uniqueId('E2E group') }
    });
    let otherGroup = await providerListingGroupService.createProviderListingGroup({
      instance,
      organizationActor: actor,
      auditScope,
      input: { name: uniqueId('E2E empty group') }
    });

    let listing = await loadListing();
    await providerListingGroupService.addProviderToGroup({
      instance,
      auditScope,
      providerListingGroup: group,
      providerListing: listing
    });
    await providerListingGroupService.addProviderToGroup({
      instance,
      auditScope,
      providerListingGroup: group,
      providerListing: listing
    });

    expect((await loadListing()).groups.map(item => item.id)).toEqual([group.id]);
    expect(
      ids(
        await firstPage(
          await providerListingService.listProviderListings({
            instance,
            providerGroupIds: [group.slug]
          })
        )
      )
    ).toEqual([listing.id]);
    expect(
      await firstPage(
        await providerListingService.listProviderListings({
          instance,
          providerGroupIds: [otherGroup.id]
        })
      )
    ).toEqual([]);
    expect(
      ids(
        await firstPage(
          await providerListingGroupService.listProviderListingGroups({
            instance,
            providerIds: [deployed.provider.id]
          })
        )
      )
    ).toEqual([group.id]);
    expect(
      ids(
        await firstPage(
          await providerListingGroupService.listProviderListingGroups({
            instance,
            ids: [group.id, otherGroup.id]
          })
        )
      ).sort()
    ).toEqual([group.id, otherGroup.id].sort());

    await providerListingGroupService.removeProviderFromGroup({
      instance,
      auditScope,
      providerListingGroup: group,
      providerListing: listing
    });
    expect((await loadListing()).groups).toEqual([]);
    expect(
      await firstPage(
        await providerListingService.listProviderListings({
          instance,
          providerGroupIds: [group.id]
        })
      )
    ).toEqual([]);
  });

  it("keeps a tenant's groups away from other tenants", async () => {
    let { instance, actor, auditScope } = mine;

    let group = await providerListingGroupService.createProviderListingGroup({
      instance,
      organizationActor: actor,
      auditScope,
      input: { name: uniqueId('E2E private group') }
    });

    await expectServiceError(
      providerListingGroupService.getProviderListingGroupById({
        instance: theirs.instance,
        providerListingGroupId: group.id
      }),
      'not_found'
    );
    await expectServiceError(
      providerListingGroupService.getProviderListingGroupById({
        instance: theirs.instance,
        providerListingGroupId: group.slug
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await providerListingGroupService.listProviderListingGroups({
          instance: theirs.instance,
          ids: [group.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await providerListingService.listProviderListings({
          instance: theirs.instance,
          providerGroupIds: [group.id]
        })
      )
    ).toEqual([]);

    await expect(
      providerListingGroupService.updateProviderListingGroup({
        instance: theirs.instance,
        auditScope: theirs.auditScope,
        providerListingGroup: group,
        input: { name: 'Hijacked' }
      })
    ).rejects.toThrow(/Tenant mismatch/);
    await expect(
      providerListingGroupService.deleteProviderListingGroup({
        instance: theirs.instance,
        auditScope: theirs.auditScope,
        providerListingGroup: group
      })
    ).rejects.toThrow(/Tenant mismatch/);

    let listing = await loadListing();
    await expect(
      providerListingGroupService.addProviderToGroup({
        instance: theirs.instance,
        auditScope: theirs.auditScope,
        providerListingGroup: group,
        providerListing: listing
      })
    ).rejects.toThrow(/Tenant mismatch/);
    expect(
      await firstPage(
        await providerListingService.listProviderListings({
          instance,
          providerGroupIds: [group.id]
        })
      )
    ).toEqual([]);

    await providerListingGroupService.addProviderToGroup({
      instance,
      auditScope,
      providerListingGroup: group,
      providerListing: listing
    });
    await expect(
      providerListingGroupService.removeProviderFromGroup({
        instance: theirs.instance,
        auditScope: theirs.auditScope,
        providerListingGroup: group,
        providerListing: listing
      })
    ).rejects.toThrow(/Tenant mismatch/);

    let unchanged = await providerListingGroupService.getProviderListingGroupById({
      instance,
      providerListingGroupId: group.id
    });
    expect(unchanged.name).toBe(group.name);
    expect(
      ids(
        await firstPage(
          await providerListingService.listProviderListings({
            instance,
            providerGroupIds: [group.id]
          })
        )
      )
    ).toEqual([listing.id]);
  });
});
