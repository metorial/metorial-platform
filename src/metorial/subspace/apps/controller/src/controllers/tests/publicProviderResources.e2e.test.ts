import { beforeEach, describe, expect, it } from 'vitest';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

describe('public-provider-resources.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('allows listing public resources without tenant/environment', async () => {
    let anonymousClient = createSubspaceControllerRootTestClient();
    let solution = await anonymousClient.solution.upsert({
      name: 'Test Solution',
      identifier: 'test-solution'
    });

    let client = createSubspaceControllerRootTestClient({
      headers: {
        'Subspace-Solution-Id': solution.id
      }
    });

    let listings = await client.providerListing.list({
      isPublic: true,
      limit: 1
    });
    expect(listings).toMatchObject({
      object: 'list'
    });

    let categories = await client.providerListingCategory.list({
      limit: 1
    });
    expect(categories).toMatchObject({
      object: 'list'
    });

    let collections = await client.providerListingCollection.list({
      limit: 1
    });
    expect(collections).toMatchObject({
      object: 'list'
    });
  });
});
