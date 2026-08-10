import { ID, get4ByteIntId, getId } from '@metorial-subspace/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';

describe('providerGroup.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('adds a provider listing to a group', async () => {
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

    let tenant = await client.tenant.upsert({
      name: 'Test Tenant',
      identifier: 'test-tenant',
      environments: [
        {
          name: 'Development',
          identifier: 'test-tenant-dev',
          type: 'development'
        }
      ]
    });

    let [tenantRecord, environmentRecord, solutionRecord] = await Promise.all([
      testDb.tenant.findUnique({ where: { id: tenant.id } }),
      testDb.environment.findUnique({ where: { identifier: 'test-tenant-dev' } }),
      testDb.solution.findUnique({ where: { id: solution.id } })
    ]);

    if (!tenantRecord || !environmentRecord || !solutionRecord) {
      throw new Error('Test setup failed to resolve tenant/environment/solution records');
    }

    let publisherTag = await testDb.providerTag.create({
      data: {
        ...getId('providerTag'),
        tag: 'pub-test-provider-group'
      }
    });
    let providerTag = await testDb.providerTag.create({
      data: {
        ...getId('providerTag'),
        tag: 'pro-test-provider-group'
      }
    });

    let providerType = await testDb.providerType.create({
      data: {
        oid: get4ByteIntId(),
        id: ID.generateIdSync('providerType'),
        shortKey: 'tpg',
        identifier: 'test-provider-group-type',
        name: 'Test Provider Group Type',
        attributes: {
          provider: 'metorial-native',
          backend: 'native',
          triggers: { status: 'disabled' },
          auth: { status: 'disabled' },
          config: { status: 'disabled' }
        }
      }
    });

    let publisher = await testDb.publisher.create({
      data: {
        ...getId('publisher'),
        type: 'tenant',
        identifier: 'test-publisher-group',
        name: 'Test Publisher',
        description: 'Publisher for provider group e2e',
        tag: publisherTag.tag,
        tenantOid: tenantRecord.oid
      }
    });

    let providerEntry = await testDb.providerEntry.create({
      data: {
        ...getId('providerEntry'),
        identifier: 'test-provider-group-entry',
        name: 'Test Provider Entry',
        description: 'Entry for provider group e2e',
        publisherOid: publisher.oid
      }
    });

    let provider = await testDb.provider.create({
      data: {
        ...getId('provider'),
        access: 'public',
        status: 'active',
        identifier: 'test-provider-group-provider',
        slug: 'test-provider-group-provider',
        name: 'Test Provider',
        description: 'Provider for provider group e2e',
        tag: providerTag.tag,
        entryOid: providerEntry.oid,
        publisherOid: publisher.oid,
        typeOid: providerType.oid
      }
    });

    let providerListing = await testDb.providerListing.create({
      data: {
        ...getId('providerListing'),
        status: 'active',
        isPublic: true,
        isCustomized: false,
        isMetorial: false,
        isVerified: false,
        isOfficial: false,
        name: 'Test Provider Listing',
        slug: 'test-provider-group-listing',
        description: 'Listing for provider group e2e',
        skills: [],
        publisherOid: publisher.oid,
        providerOid: provider.oid,
        typeOid: providerType.oid
      }
    });

    let group = await client.providerListingGroup.create({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      name: 'Test Group',
      description: 'Group for provider group e2e'
    });

    await client.providerListingGroup.addProvider({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      providerListingGroupId: group.id,
      providerListingId: providerListing.id
    });

    let fetchedListing = await client.providerListing.get({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      providerListingId: providerListing.id
    });

    expect(fetchedListing.groups).toContainEqual(
      expect.objectContaining({
        id: group.id,
        name: group.name
      })
    );

    let listingRecord = await testDb.providerListing.findUnique({
      where: { id: providerListing.id },
      include: { groups: true, collections: true }
    });

    expect(listingRecord?.groups.map(group => group.id)).toContain(group.id);
    expect(listingRecord?.collections).toHaveLength(0);
  });
});
