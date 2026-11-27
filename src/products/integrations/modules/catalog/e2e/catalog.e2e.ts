import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  providerListingCategoryService,
  providerListingGroupService,
  providerListingService
} from '../src';

describe('module-catalog', () => {
  let org = useOrganization();

  it('lists and resolves the built-in provider categories', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    let categories = await firstPage(
      await providerListingCategoryService.listProviderListingCategories({ instance })
    );
    expect(categories.map(category => category.slug)).toContain('web-search');

    let security = await providerListingCategoryService.getProviderListingCategoryById({
      instance,
      providerListingCategoryId: 'security'
    });
    expect(security.slug).toBe('security');

    await expect(
      providerListingCategoryService.getProviderListingCategoryById({
        instance,
        providerListingCategoryId: uniqueId('missing-category')
      })
    ).rejects.toThrow(/could not be found/);
  });

  it('creates, updates, lists and deletes a provider group', async () => {
    let { instance, actor, auditScope } = await loadOrganizationFixture(org.ids);
    let name = uniqueId('group');

    let group = await providerListingGroupService.createProviderListingGroup({
      instance,
      organizationActor: actor,
      auditScope,
      input: { name, description: 'E2E provider group' }
    });
    expect(group.name).toBe(name);

    let fetched = await providerListingGroupService.getProviderListingGroupById({
      instance,
      providerListingGroupId: group.slug
    });
    expect(fetched.id).toBe(group.id);

    let renamed = await providerListingGroupService.updateProviderListingGroup({
      instance,
      auditScope,
      providerListingGroup: fetched,
      input: { name: `${name}-renamed` }
    });
    expect(renamed.name).toBe(`${name}-renamed`);

    let groups = await firstPage(
      await providerListingGroupService.listProviderListingGroups({ instance })
    );
    expect(groups.map(item => item.id)).toContain(group.id);

    await providerListingGroupService.deleteProviderListingGroup({
      instance,
      auditScope,
      providerListingGroup: renamed
    });
    await expect(
      providerListingGroupService.getProviderListingGroupById({
        instance,
        providerListingGroupId: group.id
      })
    ).rejects.toThrow(/could not be found/);
  });

  it('scopes provider listings to the tenant', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    let owned = await firstPage(
      await providerListingService.listProviderListings({ instance, onlyFromTenant: true })
    );
    expect(owned).toEqual([]);

    await expect(
      providerListingService.getProviderListingById({
        instance,
        providerListingId: uniqueId('missing-listing')
      })
    ).rejects.toThrow(/could not be found/);
  });
});
