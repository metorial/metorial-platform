import {
  ID,
  get4ByteIntId,
  getId,
  type Environment,
  type Integration,
  type IntegrationInstance,
  type IntegrationProvider,
  type Provider,
  type ProviderConfig,
  type ProviderDeployment,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  integrationInstanceService,
  integrationInstanceGroupProviderService,
  integrationInstanceGroupService
} from '@metorial-subspace/module-integration';
import { syncIntegrationInstanceGroupSessionTemplate } from '@metorial-subspace/module-session/src/queues/lifecycle/linkedIntegrationInstanceGroupTemplate';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';

let suffix = () => Math.random().toString(36).slice(2, 10);

let createProviderFixture = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  key: string;
}) => {
  let backend = await testDb.backend.upsert({
    where: { type: 'native' },
    create: {
      ...getId('backend'),
      type: 'native',
      identifier: 'native',
      name: 'Native'
    },
    update: {}
  });

  let providerType = await testDb.providerType.create({
    data: {
      oid: get4ByteIntId(),
      id: ID.generateIdSync('providerType'),
      shortKey: `t${d.key}`,
      identifier: `test-provider-type-${d.key}`,
      name: `Test Provider Type ${d.key}`,
      attributes: {
        provider: 'metorial-native',
        backend: 'native',
        triggers: { status: 'disabled' },
        auth: { status: 'disabled' },
        config: { status: 'disabled' }
      }
    }
  });

  let publisherTag = await testDb.providerTag.create({
    data: { ...getId('providerTag'), tag: `pub-${d.key}` }
  });
  let providerTag = await testDb.providerTag.create({
    data: { ...getId('providerTag'), tag: `pro-${d.key}` }
  });
  let variantTag = await testDb.providerTag.create({
    data: { ...getId('providerTag'), tag: `pvr-${d.key}` }
  });
  let versionTag = await testDb.providerTag.create({
    data: { ...getId('providerTag'), tag: `prv-${d.key}` }
  });

  let publisher = await testDb.publisher.create({
    data: {
      ...getId('publisher'),
      type: 'tenant',
      identifier: `test-publisher-${d.key}`,
      name: `Test Publisher ${d.key}`,
      tag: publisherTag.tag,
      tenantOid: d.tenant.oid
    }
  });

  let providerEntry = await testDb.providerEntry.create({
    data: {
      ...getId('providerEntry'),
      identifier: `test-provider-entry-${d.key}`,
      name: `Test Provider Entry ${d.key}`,
      publisherOid: publisher.oid
    }
  });

  let provider = await testDb.provider.create({
    data: {
      ...getId('provider'),
      access: 'public',
      status: 'active',
      identifier: `test-provider-${d.key}`,
      slug: `test-provider-${d.key}`,
      name: `Test Provider ${d.key}`,
      tag: providerTag.tag,
      entryOid: providerEntry.oid,
      publisherOid: publisher.oid,
      typeOid: providerType.oid
    }
  });

  let variant = await testDb.providerVariant.create({
    data: {
      ...getId('providerVariant'),
      tag: variantTag.tag,
      identifier: `test-provider-variant-${d.key}`,
      name: `Test Provider Variant ${d.key}`,
      isDefault: true,
      backendOid: backend.oid,
      providerOid: provider.oid,
      publisherOid: publisher.oid
    }
  });

  let specification = await testDb.providerSpecification.create({
    data: {
      ...getId('providerSpecification'),
      type: 'full',
      specId: `spec-${d.key}`,
      specUniqueIdentifier: `spec-${d.key}`,
      key: `spec-${d.key}`,
      name: `Spec ${d.key}`,
      value: {
        specification: {
          specId: `spec-${d.key}`,
          specUniqueIdentifier: `spec-${d.key}`,
          key: `spec-${d.key}`,
          name: `Spec ${d.key}`,
          configJsonSchema: {
            type: 'object',
            properties: {},
            required: []
          },
          configVisibility: 'plain',
          metadata: {},
          triggers: [],
          mcp: null
        },
        features: {
          supportsAuthMethod: false,
          configContainsAuth: false
        },
        tools: [],
        triggers: [],
        authMethods: []
      },
      hash: `spec-hash-${d.key}`,
      supportsAuthMethod: false,
      configContainsAuth: false,
      providerOid: provider.oid
    }
  });

  let providerVersion = await testDb.providerVersion.create({
    data: {
      ...getId('providerVersion'),
      tag: versionTag.tag,
      identifier: `test-provider-version-${d.key}`,
      name: `Test Provider Version ${d.key}`,
      isCurrent: true,
      specificationDiscoveryStatus: 'discovered',
      backendOid: backend.oid,
      providerOid: provider.oid,
      providerVariantOid: variant.oid,
      typeOid: providerType.oid,
      specificationOid: specification.oid
    }
  });

  await testDb.providerVariant.update({
    where: { oid: variant.oid },
    data: { currentVersionOid: providerVersion.oid }
  });
  await testDb.provider.update({
    where: { oid: provider.oid },
    data: { defaultVariantOid: variant.oid }
  });

  let deployment = await testDb.providerDeployment.create({
    data: {
      ...getId('providerDeployment'),
      status: 'active',
      isEphemeral: false,
      isDefault: true,
      name: `Deployment ${d.key}`,
      networkingRulesetIds: [],
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid,
      providerOid: provider.oid,
      providerVariantOid: variant.oid
    }
  });
  let deploymentVersion = await testDb.providerDeploymentVersion.create({
    data: {
      ...getId('providerDeploymentVersion'),
      providerVariantOid: variant.oid,
      lockedVersionOid: providerVersion.oid,
      deploymentOid: deployment.oid
    }
  });
  deployment = await testDb.providerDeployment.update({
    where: { oid: deployment.oid },
    data: { currentVersionOid: deploymentVersion.oid },
    include: { currentVersion: true }
  });

  let config = await testDb.providerConfig.create({
    data: {
      ...getId('providerConfig'),
      status: 'active',
      isDefault: false,
      isEphemeral: false,
      isForVault: false,
      name: `Config ${d.key}`,
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid,
      providerOid: provider.oid,
      specificationOid: specification.oid,
      deploymentOid: deployment.oid
    }
  });

  return { provider, deployment, config };
};

let createIntegrationGraph = async (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
}) => {
  let first = await createProviderFixture({ ...d, key: `one-${suffix()}` });
  let second = await createProviderFixture({ ...d, key: `two-${suffix()}` });

  let integration = await testDb.integration.create({
    data: {
      ...getId('integration'),
      status: 'active',
      slug: `test-integration-${suffix()}`,
      name: 'Test Integration',
      canAttachCustomToolFilters: true,
      canAttachCustomProviderConfig: true,
      canOverrideToolFilters: true,
      currentVersionIndex: 0,
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid
    }
  });

  let createIntegrationProvider = async (providerFixture: {
    provider: Provider;
    deployment: ProviderDeployment;
    config: ProviderConfig;
  }) => {
    let integrationProvider = await testDb.integrationProvider.create({
      data: {
        ...getId('integrationProvider'),
        status: 'active',
        name: providerFixture.provider.name,
        currentVersionIndex: 0,
        toolFilter: { type: 'v1.allow_all' },
        integrationOid: integration.oid,
        providerOid: providerFixture.provider.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    });
    let version = await testDb.integrationProviderVersion.create({
      data: {
        ...getId('integrationProviderVersion'),
        status: 'active',
        index: 1,
        toolFilter: { type: 'v1.allow_all' },
        integrationProviderOid: integrationProvider.oid,
        deploymentOid: providerFixture.deployment.oid,
        configOid: providerFixture.config.oid
      }
    });

    integrationProvider = await testDb.integrationProvider.update({
      where: { oid: integrationProvider.oid },
      data: {
        currentVersionIndex: 1,
        currentVersionOid: version.oid
      }
    });

    return { integrationProvider, version };
  };

  let firstIntegrationProvider = await createIntegrationProvider(first);
  let secondIntegrationProvider = await createIntegrationProvider(second);

  let integrationVersion = await testDb.integrationVersion.create({
    data: {
      ...getId('integrationVersion'),
      status: 'active',
      index: 1,
      integrationOid: integration.oid
    }
  });
  await testDb.integrationVersionProvider.createMany({
    data: [firstIntegrationProvider, secondIntegrationProvider].map(provider => ({
      ...getId('integrationVersionProvider'),
      integrationVersionOid: integrationVersion.oid,
      integrationProviderVersionOid: provider.version.oid
    }))
  });
  await testDb.integration.update({
    where: { oid: integration.oid },
    data: {
      currentVersionIndex: 1,
      currentVersionOid: integrationVersion.oid
    }
  });

  let createInstanceProvider = async (
    idx: number,
    provider: {
      integrationProvider: IntegrationProvider;
      version: { oid: bigint };
    },
    fixture: { config: ProviderConfig }
  ) => {
    let instance = await testDb.integrationInstance.create({
      data: {
        ...getId('integrationInstance'),
        status: 'active',
        name: `Instance ${idx}`,
        integrationOid: integration.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    });
    let instanceProvider = await testDb.integrationInstanceProvider.create({
      data: {
        ...getId('integrationInstanceProvider'),
        status: 'active',
        name: `Instance Provider ${idx}`,
        integrationOid: integration.oid,
        integrationInstanceOid: instance.oid,
        integrationProviderOid: provider.integrationProvider.oid,
        integrationVersionOid: integrationVersion.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    });
    let version = await testDb.integrationInstanceProviderVersion.create({
      data: {
        ...getId('integrationInstanceProviderVersion'),
        status: 'active',
        integrationInstanceProviderOid: instanceProvider.oid,
        integrationProviderVersionOid: provider.version.oid,
        toolFilter: { type: 'v1.allow_all' },
        isOverrideToolFilter: false,
        configOid: fixture.config.oid
      }
    });

    return await testDb.integrationInstanceProvider.update({
      where: { oid: instanceProvider.oid },
      data: { currentVersionOid: version.oid },
      include: { integrationInstance: true, currentVersion: true }
    });
  };

  let firstInstanceProvider = await createInstanceProvider(1, firstIntegrationProvider, first);
  let secondInstanceProvider = await createInstanceProvider(
    2,
    secondIntegrationProvider,
    second
  );

  return {
    integration,
    firstInstanceProvider,
    secondInstanceProvider
  };
};

describe('integrationInstanceGroup.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('combines source integration instance providers and materializes session templates', async () => {
    let anonymousClient = createSubspaceControllerRootTestClient();
    let solution = await anonymousClient.solution.upsert({
      name: 'Test Solution',
      identifier: `test-solution-${suffix()}`
    });

    let client = createSubspaceControllerRootTestClient({
      headers: {
        'Subspace-Solution-Id': solution.id
      }
    });
    let tenant = await client.tenant.upsert({
      name: 'Test Tenant',
      identifier: `test-tenant-${suffix()}`,
      environments: [
        {
          name: 'Development',
          identifier: `test-tenant-dev-${suffix()}`,
          type: 'development'
        }
      ]
    });

    let [tenantRecord, environmentRecord, solutionRecord] = await Promise.all([
      testDb.tenant.findUnique({ where: { id: tenant.id } }),
      testDb.environment.findFirst({ where: { tenant: { id: tenant.id } } }),
      testDb.solution.findUnique({ where: { id: solution.id } })
    ]);
    if (!tenantRecord || !environmentRecord || !solutionRecord) {
      throw new Error('Test setup failed to resolve tenant/environment/solution records');
    }

    let graph = await createIntegrationGraph({
      tenant: tenantRecord,
      environment: environmentRecord,
      solution: solutionRecord
    });

    let group = await testDb.integrationInstanceGroup.create({
      data: {
        ...getId('integrationInstanceGroup'),
        status: 'draft',
        name: 'Instance group',
        tenantOid: tenantRecord.oid,
        solutionOid: solutionRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });

    let providers =
      await integrationInstanceGroupProviderService.setIntegrationInstanceGroupProviders(
        {
          tenant: tenantRecord,
          environment: environmentRecord,
          solution: solutionRecord,
          integrationInstanceGroup: group,
          input: [
            {
              integrationInstanceProviderId: graph.firstInstanceProvider.id,
              toolFilters: { type: 'tool_keys', keys: ['search'] } as any
            },
            {
              integrationInstanceProviderId: graph.secondInstanceProvider.id
            }
          ]
        }
      );

    expect(providers).toHaveLength(2);
    expect(providers[0]?.toolFilter).toMatchObject({
      type: 'v1.filter',
      filters: [{ type: 'tool_keys', keys: ['search'] }]
    });

    let fetchedGroup =
      await integrationInstanceGroupService.getIntegrationInstanceGroupById({
        tenant: tenantRecord,
        environment: environmentRecord,
        solution: solutionRecord,
        integrationInstanceGroupId: group.id
      });

    let sessionTemplate =
      await integrationInstanceGroupService.createSessionTemplateForIntegrationInstanceGroup(
        {
          tenant: tenantRecord,
          environment: environmentRecord,
          solution: solutionRecord,
          integrationInstanceGroup: fetchedGroup,
          input: { name: 'Instance group template' }
        }
      );

    await syncIntegrationInstanceGroupSessionTemplate({
      sessionTemplateId: sessionTemplate.id
    });

    let templateProviders = await testDb.sessionTemplateProvider.findMany({
      where: { sessionTemplateOid: sessionTemplate.oid, status: 'active' }
    });
    expect(templateProviders).toHaveLength(2);
    expect(templateProviders.every(provider => provider.integrationInstanceProviderOid)).toBe(
      true
    );
    expect(
      templateProviders.every(provider => provider.integrationInstanceGroupProviderOid)
    ).toBe(true);

    let session = await client.session.create({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      name: 'Instance group session',
      providers: [{ sessionTemplateId: sessionTemplate.id }]
    });

    expect(session.providers).toHaveLength(2);
  });

  it('rejects duplicate integration providers in one instance group', async () => {
    let anonymousClient = createSubspaceControllerRootTestClient();
    let solution = await anonymousClient.solution.upsert({
      name: 'Test Solution',
      identifier: `test-solution-${suffix()}`
    });
    let client = createSubspaceControllerRootTestClient({
      headers: { 'Subspace-Solution-Id': solution.id }
    });
    let tenant = await client.tenant.upsert({
      name: 'Test Tenant',
      identifier: `test-tenant-${suffix()}`,
      environments: [
        {
          name: 'Development',
          identifier: `test-tenant-dev-${suffix()}`,
          type: 'development'
        }
      ]
    });

    let [tenantRecord, environmentRecord, solutionRecord] = await Promise.all([
      testDb.tenant.findUnique({ where: { id: tenant.id } }),
      testDb.environment.findFirst({ where: { tenant: { id: tenant.id } } }),
      testDb.solution.findUnique({ where: { id: solution.id } })
    ]);
    if (!tenantRecord || !environmentRecord || !solutionRecord) {
      throw new Error('Test setup failed to resolve tenant/environment/solution records');
    }

    let graph = await createIntegrationGraph({
      tenant: tenantRecord,
      environment: environmentRecord,
      solution: solutionRecord
    });
    let duplicateInstance = await testDb.integrationInstance.create({
      data: {
        ...getId('integrationInstance'),
        status: 'active',
        name: 'Duplicate provider instance',
        integrationOid: graph.integration.oid,
        tenantOid: tenantRecord.oid,
        solutionOid: solutionRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });
    let duplicateProvider = await testDb.integrationInstanceProvider.create({
      data: {
        ...getId('integrationInstanceProvider'),
        status: 'active',
        name: 'Duplicate instance provider',
        integrationOid: graph.integration.oid,
        integrationInstanceOid: duplicateInstance.oid,
        integrationProviderOid: graph.firstInstanceProvider.integrationProviderOid,
        integrationVersionOid: graph.firstInstanceProvider.integrationVersionOid,
        tenantOid: tenantRecord.oid,
        solutionOid: solutionRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });
    let duplicateVersion = await testDb.integrationInstanceProviderVersion.create({
      data: {
        ...getId('integrationInstanceProviderVersion'),
        status: 'active',
        integrationInstanceProviderOid: duplicateProvider.oid,
        integrationProviderVersionOid:
          graph.firstInstanceProvider.currentVersion!.integrationProviderVersionOid,
        toolFilter: { type: 'v1.allow_all' },
        isOverrideToolFilter: false,
        configOid: graph.firstInstanceProvider.currentVersion!.configOid
      }
    });
    await testDb.integrationInstanceProvider.update({
      where: { oid: duplicateProvider.oid },
      data: { currentVersionOid: duplicateVersion.oid }
    });

    let group = await testDb.integrationInstanceGroup.create({
      data: {
        ...getId('integrationInstanceGroup'),
        status: 'draft',
        name: 'Instance group',
        tenantOid: tenantRecord.oid,
        solutionOid: solutionRecord.oid,
        environmentOid: environmentRecord.oid
      }
    });

    await expect(
      integrationInstanceGroupProviderService.setIntegrationInstanceGroupProviders({
        tenant: tenantRecord,
        environment: environmentRecord,
        solution: solutionRecord,
        integrationInstanceGroup: group,
        input: [
          { integrationInstanceProviderId: graph.firstInstanceProvider.id },
          { integrationInstanceProviderId: duplicateProvider.id }
        ]
      })
    ).rejects.toThrow(/duplicate integration providers/i);
  });

  it('auto-materializes configless integration providers when creating an integration instance', async () => {
    let anonymousClient = createSubspaceControllerRootTestClient();
    let solution = await anonymousClient.solution.upsert({
      name: 'Test Solution',
      identifier: `test-solution-${suffix()}`
    });
    let client = createSubspaceControllerRootTestClient({
      headers: { 'Subspace-Solution-Id': solution.id }
    });
    let tenant = await client.tenant.upsert({
      name: 'Test Tenant',
      identifier: `test-tenant-${suffix()}`,
      environments: [
        {
          name: 'Development',
          identifier: `test-tenant-dev-${suffix()}`,
          type: 'development'
        }
      ]
    });

    let [tenantRecord, environmentRecord, solutionRecord] = await Promise.all([
      testDb.tenant.findUnique({ where: { id: tenant.id } }),
      testDb.environment.findFirst({ where: { tenant: { id: tenant.id } } }),
      testDb.solution.findUnique({ where: { id: solution.id } })
    ]);
    if (!tenantRecord || !environmentRecord || !solutionRecord) {
      throw new Error('Test setup failed to resolve tenant/environment/solution records');
    }

    let graph = await createIntegrationGraph({
      tenant: tenantRecord,
      environment: environmentRecord,
      solution: solutionRecord
    });

    let integrationInstance = await integrationInstanceService.createIntegrationInstance({
      tenant: tenantRecord,
      environment: environmentRecord,
      solution: solutionRecord,
      integration: graph.integration,
      input: {
        name: 'Auto-configured instance'
      }
    });

    expect(integrationInstance.integrationInstanceProviders).toHaveLength(2);
    expect(
      integrationInstance.integrationInstanceProviders.every(
        provider => provider.currentVersion?.config?.isDefault === true
      )
    ).toBe(true);

    let defaultConfigs = await testDb.providerConfig.findMany({
      where: {
        oid: {
          in: integrationInstance.integrationInstanceProviders
            .map(provider => provider.currentVersion?.configOid)
            .filter(Boolean) as bigint[]
        }
      }
    });

    expect(defaultConfigs).toHaveLength(2);
    expect(defaultConfigs.every(config => config.isDefault)).toBe(true);
  });
});
