import { ID, get4ByteIntId, getId } from '@metorial-subspace/db';
import { customProviderEnvironmentService } from '@metorial-subspace/module-custom-provider';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';

let createTenantContext = async () => {
  let anonymousClient = createSubspaceControllerRootTestClient();
  let solution = await anonymousClient.solution.upsert({
    name: 'Custom Provider Visibility Solution',
    identifier: 'custom-provider-visibility-solution'
  });

  let client = createSubspaceControllerRootTestClient({
    headers: {
      'Subspace-Solution-Id': solution.id
    }
  });

  let tenant = await client.tenant.upsert({
    name: 'Custom Provider Visibility Tenant',
    identifier: 'custom-provider-visibility-tenant',
    environments: [
      {
        name: 'Development',
        identifier: 'custom-provider-visibility-dev',
        type: 'development'
      },
      {
        name: 'Production',
        identifier: 'custom-provider-visibility-prod',
        type: 'production'
      }
    ]
  });

  let [tenantRecord, devEnvironment, prodEnvironment, solutionRecord] = await Promise.all([
    testDb.tenant.findUniqueOrThrow({ where: { id: tenant.id } }),
    testDb.environment.findUniqueOrThrow({
      where: { identifier: 'custom-provider-visibility-dev' }
    }),
    testDb.environment.findUniqueOrThrow({
      where: { identifier: 'custom-provider-visibility-prod' }
    }),
    testDb.solution.findUniqueOrThrow({ where: { id: solution.id } })
  ]);

  return { client, tenant, tenantRecord, devEnvironment, prodEnvironment, solutionRecord };
};

let createCustomProviderFixture = async (d: Awaited<ReturnType<typeof createTenantContext>>) => {
  let actor = await testDb.tenantActor.create({
    data: {
      ...getId('actor'),
      type: 'system',
      identifier: 'custom-provider-visibility-system',
      name: 'Custom Provider Visibility System',
      tenantOid: d.tenantRecord.oid
    }
  });

  let backend = await testDb.backend.create({
    data: {
      ...getId('backend'),
      type: 'shuttle',
      identifier: 'custom-provider-visibility-shuttle',
      name: 'Custom Provider Visibility Shuttle'
    }
  });

  let publisherTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: 'pub-custom-provider-visibility'
    }
  });
  let providerTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: 'pro-custom-provider-visibility'
    }
  });
  let providerVersionTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: 'ver-custom-provider-visibility'
    }
  });
  let providerVariantTag = await testDb.providerTag.create({
    data: {
      ...getId('providerTag'),
      tag: 'var-custom-provider-visibility'
    }
  });

  let providerType = await testDb.providerType.create({
    data: {
      oid: get4ByteIntId(),
      id: ID.generateIdSync('providerType'),
      shortKey: 'cpv',
      identifier: 'custom-provider-visibility-type',
      name: 'Custom Provider Visibility Type',
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
      identifier: 'custom-provider-visibility-publisher',
      name: 'Custom Provider Visibility Publisher',
      description: 'Publisher for custom provider visibility tests',
      tag: publisherTag.tag,
      tenantOid: d.tenantRecord.oid
    }
  });

  let providerEntry = await testDb.providerEntry.create({
    data: {
      ...getId('providerEntry'),
      identifier: 'custom-provider-visibility-entry',
      name: 'Custom Provider Visibility Entry',
      description: 'Entry for custom provider visibility tests',
      publisherOid: publisher.oid
    }
  });

  let provider = await testDb.provider.create({
    data: {
      ...getId('provider'),
      access: 'tenant',
      status: 'active',
      hasEnvironments: true,
      identifier: 'custom-provider-visibility-provider',
      slug: 'custom-provider-visibility-provider',
      name: 'Custom Provider Visibility Provider',
      description: 'Provider for custom provider visibility tests',
      tag: providerTag.tag,
      entryOid: providerEntry.oid,
      publisherOid: publisher.oid,
      ownerTenantOid: d.tenantRecord.oid,
      ownerSolutionOid: d.solutionRecord.oid,
      typeOid: providerType.oid
    }
  });

  let providerVariant = await testDb.providerVariant.create({
    data: {
      ...getId('providerVariant'),
      tag: providerVariantTag.tag,
      identifier: 'custom-provider-visibility-variant',
      name: 'Custom Provider Visibility Variant',
      description: 'Variant for custom provider visibility tests',
      isDefault: true,
      backendOid: backend.oid,
      providerOid: provider.oid,
      publisherOid: publisher.oid
    }
  });

  await testDb.provider.update({
    where: { oid: provider.oid },
    data: { defaultVariantOid: providerVariant.oid }
  });

  let providerVersion = await testDb.providerVersion.create({
    data: {
      ...getId('providerVersion'),
      tag: providerVersionTag.tag,
      identifier: 'custom-provider-visibility-version',
      name: 'Custom Provider Visibility Version',
      description: 'Version for custom provider visibility tests',
      isCurrent: true,
      isEnvironmentLocked: true,
      specificationDiscoveryStatus: 'not_discoverable',
      backendOid: backend.oid,
      providerOid: provider.oid,
      providerVariantOid: providerVariant.oid,
      typeOid: providerType.oid
    }
  });

  await testDb.providerVariant.update({
    where: { oid: providerVariant.oid },
    data: { currentVersionOid: providerVersion.oid }
  });

  let customProvider = await testDb.customProvider.create({
    data: {
      ...getId('customProvider'),
      type: 'remote',
      status: 'active',
      name: 'Custom Provider Visibility Custom Provider',
      description: 'Custom provider for visibility tests',
      payload: {
        from: {
          type: 'remote',
          remoteUrl: 'https://example.com/mcp',
          protocol: 'sse'
        }
      },
      tenantOid: d.tenantRecord.oid,
      solutionOid: d.solutionRecord.oid,
      providerOid: provider.oid,
      providerVariantOid: providerVariant.oid
    }
  });

  let deployment = await testDb.customProviderDeployment.create({
    data: {
      ...getId('customProviderDeployment'),
      status: 'succeeded',
      trigger: 'manual',
      creatorActorOid: actor.oid,
      tenantOid: d.tenantRecord.oid,
      solutionOid: d.solutionRecord.oid,
      customProviderOid: customProvider.oid
    }
  });

  let customProviderVersion = await testDb.customProviderVersion.create({
    data: {
      ...getId('customProviderVersion'),
      status: 'deployment_succeeded',
      versionIndex: 1,
      versionIdentifier: 'v1',
      payload: customProvider.payload,
      creatorActorOid: actor.oid,
      customProviderOid: customProvider.oid,
      tenantOid: d.tenantRecord.oid,
      solutionOid: d.solutionRecord.oid,
      providerVersionOid: providerVersion.oid,
      deploymentOid: deployment.oid
    }
  });

  let providerListing = await testDb.providerListing.create({
    data: {
      ...getId('providerListing'),
      status: 'active',
      isPublic: false,
      isCustomized: false,
      isMetorial: false,
      isVerified: false,
      isOfficial: false,
      name: 'Custom Provider Visibility Listing',
      slug: 'custom-provider-visibility-listing',
      description: 'Listing for custom provider visibility tests',
      skills: [],
      ownerTenantOid: d.tenantRecord.oid,
      ownerSolutionOid: d.solutionRecord.oid,
      publisherOid: publisher.oid,
      providerOid: provider.oid,
      typeOid: providerType.oid
    }
  });

  let devCustomProviderEnvironment = await testDb.customProviderEnvironment.create({
    data: {
      ...getId('customProviderEnvironment'),
      tenantOid: d.tenantRecord.oid,
      solutionOid: d.solutionRecord.oid,
      environmentOid: d.devEnvironment.oid,
      customProviderOid: customProvider.oid
    }
  });

  let prodCustomProviderEnvironment = await testDb.customProviderEnvironment.create({
    data: {
      ...getId('customProviderEnvironment'),
      tenantOid: d.tenantRecord.oid,
      solutionOid: d.solutionRecord.oid,
      environmentOid: d.prodEnvironment.oid,
      customProviderOid: customProvider.oid
    }
  });

  let publishToEnvironment = async (environmentOid: bigint, customProviderEnvironmentOid: bigint) => {
    let providerEnvironment = await testDb.providerEnvironment.create({
      data: {
        ...getId('providerEnvironment'),
        tenantOid: d.tenantRecord.oid,
        solutionOid: d.solutionRecord.oid,
        environmentOid,
        providerOid: provider.oid,
        providerVariantOid: providerVariant.oid,
        currentVersionOid: providerVersion.oid
      }
    });

    await testDb.providerEnvironmentVersion.create({
      data: {
        ...getId('providerEnvironmentVersion'),
        providerEnvironmentOid: providerEnvironment.oid,
        providerVersionOid: providerVersion.oid,
        environmentOid
      }
    });

    await testDb.customProviderEnvironment.update({
      where: { oid: customProviderEnvironmentOid },
      data: { providerEnvironmentOid: providerEnvironment.oid }
    });
  };

  await publishToEnvironment(d.devEnvironment.oid, devCustomProviderEnvironment.oid);

  return {
    provider,
    providerListing,
    customProvider,
    customProviderVersion,
    devCustomProviderEnvironment,
    prodCustomProviderEnvironment,
    publishToEnvironment
  };
};

describe('customProviderVisibility.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('only lists custom providers and listings in published environments', async () => {
    let ctx = await createTenantContext();
    let fixture = await createCustomProviderFixture(ctx);

    let devListings = await ctx.client.providerListing.list({
      tenantId: ctx.tenant.id,
      environmentId: ctx.devEnvironment.id,
      ids: [fixture.providerListing.id],
      limit: 10
    });
    expect(devListings.items.map(item => item.id)).toContain(fixture.providerListing.id);

    let prodListings = await ctx.client.providerListing.list({
      tenantId: ctx.tenant.id,
      environmentId: ctx.prodEnvironment.id,
      ids: [fixture.providerListing.id],
      limit: 10
    });
    expect(prodListings.items).toHaveLength(0);

    let devCustomProviders = await ctx.client.customProvider.list({
      tenantId: ctx.tenant.id,
      environmentId: ctx.devEnvironment.id,
      ids: [fixture.customProvider.id],
      limit: 10
    });
    expect(devCustomProviders.items.map(item => item.id)).toContain(fixture.customProvider.id);

    let prodCustomProviders = await ctx.client.customProvider.list({
      tenantId: ctx.tenant.id,
      environmentId: ctx.prodEnvironment.id,
      ids: [fixture.customProvider.id],
      limit: 10
    });
    expect(prodCustomProviders.items).toHaveLength(0);

    await expect(
      ctx.client.customProvider.get({
        tenantId: ctx.tenant.id,
        environmentId: ctx.prodEnvironment.id,
        customProviderId: fixture.customProvider.id
      })
    ).rejects.toThrow();

    await fixture.publishToEnvironment(
      ctx.prodEnvironment.oid,
      fixture.prodCustomProviderEnvironment.oid
    );

    let publishedProdCustomProviders = await ctx.client.customProvider.list({
      tenantId: ctx.tenant.id,
      environmentId: ctx.prodEnvironment.id,
      ids: [fixture.customProvider.id],
      limit: 10
    });
    expect(publishedProdCustomProviders.items.map(item => item.id)).toContain(
      fixture.customProvider.id
    );
  });

  it('keeps unpublished target environments resolvable for publish commits', async () => {
    let ctx = await createTenantContext();
    let fixture = await createCustomProviderFixture(ctx);

    await expect(
      customProviderEnvironmentService.getCustomProviderEnvironmentById({
        tenant: ctx.tenantRecord,
        solution: ctx.solutionRecord,
        environment: ctx.devEnvironment,
        customProviderEnvironmentId: fixture.prodCustomProviderEnvironment.id
      })
    ).rejects.toThrow();

    let targetEnvironment =
      await customProviderEnvironmentService.getCustomProviderEnvironmentById({
        tenant: ctx.tenantRecord,
        solution: ctx.solutionRecord,
        environment: ctx.devEnvironment,
        customProviderEnvironmentId: fixture.prodCustomProviderEnvironment.id,
        includeUnpublished: true,
        includeOtherEnvironments: true
      });

    expect(targetEnvironment.id).toBe(fixture.prodCustomProviderEnvironment.id);
  });
});
