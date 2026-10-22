import {
  connectSession,
  createRemoteProvider,
  eventually,
  expectServiceError,
  findTool,
  firstPage,
  type RemoteProvider,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  type CreateIntegrationParams,
  integrationInstanceGroupService,
  integrationInstanceProviderService,
  integrationInstanceService,
  integrationProviderService,
  integrationService,
  integrationVersionService,
  type SetIntegrationInstanceProviderInput
} from '../src';

let workerTimeout = { timeoutMs: 60_000, intervalMs: 500 };
let providerTestTimeout = 180_000;

let echoOnlyFilter: PrismaJson.ToolFilter = {
  type: 'v1.filter',
  filters: [{ type: 'tool_keys', keys: ['echo'] }]
};

describe('module-integration integration providers', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let remoteProvider: Promise<RemoteProvider> | undefined;
  let getRemoteProvider = () =>
    (remoteProvider ??= createRemoteProvider(org.clients.instance, { url: server.url }));

  let createIntegration = async (input: Partial<CreateIntegrationParams['input']> = {}) => {
    let fixture = await loadOrganizationFixture(org.ids);
    let integration = await integrationService.createIntegration({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Integration'), ...input }
    });

    return { fixture, integration };
  };

  let attachProvider = async (
    d: {
      integration?: Partial<CreateIntegrationParams['input']>;
      toolFilters?: PrismaJson.ToolFilter;
    } = {}
  ) => {
    let { providerId, provider } = await getRemoteProvider();
    let { fixture, integration } = await createIntegration(d.integration);

    let integrationProvider = await integrationProviderService.createIntegrationProvider({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integration,
      input: { providerId, toolFilters: d.toolFilters }
    });

    return { fixture, integration, integrationProvider, providerId, provider };
  };

  let createInstance = async (d: {
    fixture: Awaited<ReturnType<typeof loadOrganizationFixture>>;
    integration: Parameters<
      typeof integrationInstanceService.createIntegrationInstance
    >[0]['integration'];
    providers?: SetIntegrationInstanceProviderInput[];
    name?: string;
  }) =>
    integrationInstanceService.createIntegrationInstance({
      instance: d.fixture.instance,
      auditScope: d.fixture.auditScope,
      integration: d.integration,
      input: { name: d.name ?? uniqueId('Instance'), providers: d.providers }
    });

  let getIntegrationProvider = (
    fixture: Awaited<ReturnType<typeof loadOrganizationFixture>>,
    integrationProviderId: string
  ) =>
    integrationProviderService.getIntegrationProviderById({
      instance: fixture.instance,
      integrationProviderId
    });

  it(
    'attaches a provider, versions the integration and rejects a duplicate',
    async () => {
      let { fixture, integration, integrationProvider, providerId, provider } =
        await attachProvider();
      let { instance, auditScope } = fixture;

      expect(integrationProvider).toMatchObject({
        status: 'active',
        name: provider.name,
        integrationOid: integration.oid,
        areCallbacksEnabled: false,
        currentVersionIndex: 1
      });
      expect(integrationProvider.provider.id).toBe(providerId);
      expect(integrationProvider.currentVersion).toMatchObject({ status: 'active', index: 1 });
      expect(integrationProvider.currentVersion!.deployment.providerOid).toBe(
        integrationProvider.providerOid
      );

      let row = await subspaceDb.integration.findUniqueOrThrow({
        where: { id: integration.id },
        include: { currentVersion: { include: { providers: true } } }
      });
      expect(row.currentVersionIndex).toBe(2);
      expect(
        row.currentVersion!.providers.map(version => version.integrationProviderVersionOid)
      ).toEqual([integrationProvider.currentVersionOid]);

      let fetched = await integrationService.getIntegrationById({
        instance,
        integrationId: integration.id
      });
      expect(fetched.providers.map(item => item.id)).toEqual([integrationProvider.id]);

      let byProvider = await firstPage(
        await integrationService.listIntegrations({
          instance,
          ids: [integration.id],
          providerIds: [providerId]
        })
      );
      expect(byProvider.map(item => item.id)).toEqual([integration.id]);
      let byIntegrationProvider = await firstPage(
        await integrationService.listIntegrations({
          instance,
          integrationProviderIds: [integrationProvider.id]
        })
      );
      expect(byIntegrationProvider.map(item => item.id)).toEqual([integration.id]);

      let integrationProviders = await firstPage(
        await integrationProviderService.listIntegrationProviders({
          instance,
          integrationIds: [integration.id]
        })
      );
      expect(integrationProviders.map(item => item.id)).toEqual([integrationProvider.id]);

      let versions = await firstPage(
        await integrationVersionService.listIntegrationVersions({
          instance,
          integrationIds: [integration.id]
        })
      );
      expect(versions.map(version => version.index).sort()).toEqual([1, 2]);
      let versionsWithProvider = await firstPage(
        await integrationVersionService.listIntegrationVersions({
          instance,
          integrationProviderIds: [integrationProvider.id]
        })
      );
      expect(versionsWithProvider.map(version => version.id)).toEqual([
        row.currentVersion!.id
      ]);

      await expectServiceError(
        integrationProviderService.createIntegrationProvider({
          instance,
          auditScope,
          integration: fetched,
          input: { providerId }
        }),
        'integration_provider_exists'
      );
      expect(
        await subspaceDb.integrationProvider.count({
          where: { integrationOid: integration.oid }
        })
      ).toBe(1);
    },
    providerTestTimeout
  );

  it(
    'rejects attaching unknown providers and attaching to archived integrations',
    async () => {
      let { providerId } = await getRemoteProvider();
      let { fixture, integration } = await createIntegration();
      let { instance, auditScope } = fixture;

      await expectServiceError(
        integrationProviderService.createIntegrationProvider({
          instance,
          auditScope,
          integration,
          input: { providerId: uniqueId('missing-provider') }
        }),
        'not_found'
      );

      let archived = await integrationService.archiveIntegration({
        instance,
        auditScope,
        integration
      });
      await expectServiceError(
        integrationProviderService.createIntegrationProvider({
          instance,
          auditScope,
          integration: archived,
          input: { providerId }
        }),
        'use_after_delete'
      );
      expect(
        await subspaceDb.integrationProvider.count({
          where: { integrationOid: integration.oid }
        })
      ).toBe(0);
    },
    providerTestTimeout
  );

  it(
    'only creates new versions for material provider changes',
    async () => {
      let { fixture, integration, integrationProvider } = await attachProvider();
      let { instance, auditScope } = fixture;
      let renamed = uniqueId('Renamed');

      let updated = await integrationProviderService.updateIntegrationProvider({
        instance,
        auditScope,
        integrationProvider: await getIntegrationProvider(fixture, integrationProvider.id),
        input: { name: `  ${renamed}  `, description: 'Described' }
      });
      expect(updated).toMatchObject({ name: renamed, description: 'Described' });
      expect(updated.currentVersionOid).toBe(integrationProvider.currentVersionOid);
      expect(
        (await subspaceDb.integration.findUniqueOrThrow({ where: { id: integration.id } }))
          .currentVersionIndex
      ).toBe(2);

      let filtered = await integrationProviderService.updateIntegrationProvider({
        instance,
        auditScope,
        integrationProvider: await getIntegrationProvider(fixture, integrationProvider.id),
        input: { toolFilters: echoOnlyFilter }
      });
      expect(filtered.name).toBe(renamed);
      expect(filtered.currentVersionOid).not.toBe(integrationProvider.currentVersionOid);
      expect(filtered.currentVersion).toMatchObject({ index: 2, status: 'active' });
      expect(filtered.currentVersion!.toolFilter).toMatchObject(echoOnlyFilter);
      expect(filtered.toolFilter).toMatchObject(echoOnlyFilter);

      let row = await subspaceDb.integration.findUniqueOrThrow({
        where: { id: integration.id },
        include: { currentVersion: { include: { providers: true } } }
      });
      expect(row.currentVersionIndex).toBe(3);
      expect(
        row.currentVersion!.providers.map(version => version.integrationProviderVersionOid)
      ).toEqual([filtered.currentVersionOid]);
    },
    providerTestTimeout
  );

  it(
    'archives a provider, rejects edits and reactivates it when attached again',
    async () => {
      let { fixture, integration, integrationProvider, providerId } = await attachProvider();
      let { instance, auditScope } = fixture;

      let archived = await integrationProviderService.archiveIntegrationProvider({
        instance,
        auditScope,
        integrationProvider
      });
      expect(archived.status).toBe('archived');
      expect(archived.archivedAt).toBeInstanceOf(Date);
      expect(archived.currentVersion).toMatchObject({ status: 'archived', index: 2 });

      let row = await subspaceDb.integration.findUniqueOrThrow({
        where: { id: integration.id },
        include: { currentVersion: { include: { providers: true } } }
      });
      expect(row.currentVersionIndex).toBe(3);
      expect(row.currentVersion!.providers).toEqual([]);

      let fetchedIntegration = await integrationService.getIntegrationById({
        instance,
        integrationId: integration.id
      });
      expect(fetchedIntegration.providers).toEqual([]);
      expect(
        await firstPage(
          await integrationProviderService.listIntegrationProviders({
            instance,
            integrationIds: [integration.id]
          })
        )
      ).toEqual([]);

      let fetched = await getIntegrationProvider(fixture, integrationProvider.id);
      expect(fetched.status).toBe('archived');
      await expectServiceError(
        integrationProviderService.updateIntegrationProvider({
          instance,
          auditScope,
          integrationProvider: fetched,
          input: { name: uniqueId('Renamed') }
        }),
        'gone'
      );
      await expectServiceError(
        integrationProviderService.archiveIntegrationProvider({
          instance,
          auditScope,
          integrationProvider: fetched
        }),
        'gone'
      );

      let reattached = await integrationProviderService.createIntegrationProvider({
        instance,
        auditScope,
        integration: fetchedIntegration,
        input: { providerId }
      });
      expect(reattached).toMatchObject({
        id: integrationProvider.id,
        status: 'active',
        archivedAt: null
      });
      expect(reattached.currentVersion).toMatchObject({ status: 'active', index: 3 });
    },
    providerTestTimeout
  );

  it(
    'sets instance providers by integration provider or provider id and activates the instance',
    async () => {
      let { fixture, integration, integrationProvider, providerId } = await attachProvider();
      let { instance } = fixture;

      let integrationInstance = await createInstance({
        fixture,
        integration,
        providers: [{ providerId: integrationProvider.id }]
      });
      expect(integrationInstance.status).toBe('active');
      expect(integrationInstance.integrationInstanceProviders).toHaveLength(1);
      let [integrationInstanceProvider] = integrationInstance.integrationInstanceProviders;
      expect(integrationInstanceProvider).toMatchObject({
        status: 'active',
        integrationProviderOid: integrationProvider.oid,
        integrationInstanceOid: integrationInstance.oid
      });
      expect(integrationInstanceProvider!.currentVersion).toMatchObject({
        status: 'active',
        isOverrideToolFilter: false,
        integrationProviderVersionOid: integrationProvider.currentVersionOid
      });
      expect(integrationInstanceProvider!.currentVersion!.configOid).not.toBeNull();

      let byProviderId = await createInstance({
        fixture,
        integration,
        providers: [{ providerId }]
      });
      expect(byProviderId.status).toBe('active');
      expect(
        byProviderId.integrationInstanceProviders.map(item => item.integrationProviderOid)
      ).toEqual([integrationProvider.oid]);

      let listed = await firstPage(
        await integrationInstanceProviderService.listIntegrationInstanceProviders({
          instance,
          integrationInstanceIds: [integrationInstance.id]
        })
      );
      expect(listed.map(item => item.id)).toEqual([integrationInstanceProvider!.id]);

      let fetched =
        await integrationInstanceProviderService.getIntegrationInstanceProviderById({
          instance,
          integrationInstanceProviderId: integrationInstanceProvider!.id
        });
      expect(fetched.integrationInstance.id).toBe(integrationInstance.id);

      let byProvider = await firstPage(
        await integrationInstanceService.listIntegrationInstances({
          instance,
          integrationIds: [integration.id],
          providerIds: [providerId]
        })
      );
      expect(byProvider.map(item => item.id).sort()).toEqual(
        [integrationInstance.id, byProviderId.id].sort()
      );

      let other = await loadOrganizationFixture(otherOrg.ids);
      await expectServiceError(
        integrationInstanceProviderService.getIntegrationInstanceProviderById({
          instance: other.instance,
          integrationInstanceProviderId: integrationInstanceProvider!.id
        }),
        'not_found'
      );
      await expectServiceError(
        getIntegrationProvider(other, integrationProvider.id),
        'not_found'
      );
    },
    providerTestTimeout
  );

  it(
    'rejects invalid instance providers and rolls the instance back',
    async () => {
      let { fixture, integration, integrationProvider, providerId } = await attachProvider();
      let { integrationProvider: foreignIntegrationProvider } = await attachProvider();
      let { integration: providerlessIntegration } = await createIntegration();

      let attempt = async (
        target: Parameters<typeof createInstance>[0]['integration'],
        providers: SetIntegrationInstanceProviderInput[],
        code: string
      ) => {
        let name = uniqueId('Rejected');
        await expectServiceError(
          createInstance({ fixture, integration: target, name, providers }),
          code
        );
        expect(await subspaceDb.integrationInstance.count({ where: { name } })).toBe(0);
      };

      await attempt(
        integration,
        [{ providerId: foreignIntegrationProvider.id }],
        'integration_instance_provider_mismatch'
      );
      await attempt(providerlessIntegration, [{ providerId }], 'not_found');
      await attempt(
        integration,
        [{ providerId: integrationProvider.id }, { providerId }],
        'duplicate_integration_instance_provider'
      );
    },
    providerTestTimeout
  );

  it(
    'enforces the integration tool filter rules on instance providers',
    async () => {
      let strict = await attachProvider({
        integration: { canAttachCustomToolFilters: false, canOverrideToolFilters: false }
      });

      await expectServiceError(
        createInstance({
          fixture: strict.fixture,
          integration: strict.integration,
          providers: [
            { providerId: strict.integrationProvider.id, toolFilters: echoOnlyFilter }
          ]
        }),
        'custom_tool_filters_not_allowed'
      );
      await expectServiceError(
        createInstance({
          fixture: strict.fixture,
          integration: strict.integration,
          providers: [
            { providerId: strict.integrationProvider.id, isOverrideToolFilter: true }
          ]
        }),
        'tool_filter_override_not_allowed'
      );

      let allowAll = await createInstance({
        fixture: strict.fixture,
        integration: strict.integration,
        providers: [
          { providerId: strict.integrationProvider.id, toolFilters: { type: 'v1.allow_all' } }
        ]
      });
      expect(allowAll.integrationInstanceProviders[0]!.currentVersion!.toolFilter).toBeNull();

      let flexible = await attachProvider({ integration: { canOverrideToolFilters: true } });
      let overriding = await createInstance({
        fixture: flexible.fixture,
        integration: flexible.integration,
        providers: [
          {
            providerId: flexible.integrationProvider.id,
            toolFilters: echoOnlyFilter,
            isOverrideToolFilter: true
          }
        ]
      });
      let version = overriding.integrationInstanceProviders[0]!.currentVersion!;
      expect(version.isOverrideToolFilter).toBe(true);
      expect(version.toolFilter).toMatchObject(echoOnlyFilter);
    },
    providerTestTimeout
  );

  it(
    'archives instance providers when their integration provider is archived',
    async () => {
      let { fixture, integration, integrationProvider } = await attachProvider();
      let integrationInstance = await createInstance({
        fixture,
        integration,
        providers: [{ providerId: integrationProvider.id }]
      });
      let [integrationInstanceProvider] = integrationInstance.integrationInstanceProviders;

      await integrationProviderService.archiveIntegrationProvider({
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        integrationProvider
      });

      await eventually(async () => {
        let row = await subspaceDb.integrationInstanceProvider.findUniqueOrThrow({
          where: { id: integrationInstanceProvider!.id }
        });
        expect(row).toMatchObject({ status: 'archived', isParentDeleted: true });
      }, workerTimeout);

      let fetched = await integrationInstanceService.getIntegrationInstanceById({
        instance: fixture.instance,
        integrationInstanceId: integrationInstance.id
      });
      expect(fetched.integrationInstanceProviders).toEqual([]);
    },
    providerTestTimeout
  );

  it(
    'archives providers, instances and instance providers of an archived integration',
    async () => {
      let { fixture, integration, integrationProvider } = await attachProvider();
      let integrationInstance = await createInstance({
        fixture,
        integration,
        providers: [{ providerId: integrationProvider.id }]
      });
      let [integrationInstanceProvider] = integrationInstance.integrationInstanceProviders;

      await integrationService.archiveIntegration({
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        integration
      });

      await eventually(async () => {
        let [providerRow, instanceRow, instanceProviderRow] = await Promise.all([
          subspaceDb.integrationProvider.findUniqueOrThrow({
            where: { id: integrationProvider.id },
            include: { currentVersion: true }
          }),
          subspaceDb.integrationInstance.findUniqueOrThrow({
            where: { id: integrationInstance.id }
          }),
          subspaceDb.integrationInstanceProvider.findUniqueOrThrow({
            where: { id: integrationInstanceProvider!.id }
          })
        ]);

        expect(providerRow.status).toBe('archived');
        expect(providerRow.currentVersion?.status).toBe('archived');
        expect(instanceRow).toMatchObject({ status: 'archived', isParentDeleted: true });
        expect(instanceProviderRow.status).toBe('archived');
      }, workerTimeout);
    },
    providerTestTimeout
  );

  it(
    'groups instance providers, validates them and archives the group',
    async () => {
      let { fixture, integration, integrationProvider } = await attachProvider();
      let { instance, auditScope } = fixture;
      let integrationInstance = await createInstance({
        fixture,
        integration,
        providers: [{ providerId: integrationProvider.id }]
      });
      let [integrationInstanceProvider] = integrationInstance.integrationInstanceProviders;

      let empty = await integrationInstanceGroupService.createIntegrationInstanceGroup({
        instance,
        auditScope,
        input: { name: uniqueId('Group') }
      });
      expect(empty.status).toBe('draft');

      await expectServiceError(
        integrationInstanceGroupService.createIntegrationInstanceGroup({
          instance,
          auditScope,
          input: {
            name: uniqueId('Group'),
            providers: [{ integrationInstanceProviderId: uniqueId('missing-provider') }]
          }
        }),
        'not_found'
      );
      await expectServiceError(
        integrationInstanceGroupService.createIntegrationInstanceGroup({
          instance,
          auditScope,
          input: {
            name: uniqueId('Group'),
            providers: [
              { integrationInstanceProviderId: integrationInstanceProvider!.id },
              { integrationInstanceProviderId: integrationInstanceProvider!.id }
            ]
          }
        }),
        'duplicate_integration_instance_group_provider'
      );

      let group = await integrationInstanceGroupService.createIntegrationInstanceGroup({
        instance,
        auditScope,
        input: {
          name: uniqueId('Group'),
          providers: [{ integrationInstanceProviderId: integrationInstanceProvider!.id }]
        }
      });
      expect(group.status).toBe('active');
      expect(group.sources.map(source => source.integrationInstance.id)).toEqual([
        integrationInstance.id
      ]);
      expect(group.providers.map(provider => provider.integrationInstanceProvider.id)).toEqual(
        [integrationInstanceProvider!.id]
      );

      let byInstance = await firstPage(
        await integrationInstanceGroupService.listIntegrationInstanceGroups({
          instance,
          integrationInstanceIds: [integrationInstance.id]
        })
      );
      expect(byInstance.map(item => item.id)).toEqual([group.id]);

      let renamed = uniqueId('Renamed');
      let updated = await integrationInstanceGroupService.updateIntegrationInstanceGroup({
        instance,
        auditScope,
        integrationInstanceGroup:
          await integrationInstanceGroupService.getIntegrationInstanceGroupById({
            instance,
            integrationInstanceGroupId: group.id
          }),
        input: { name: renamed }
      });
      expect(updated).toMatchObject({ name: renamed, status: 'active' });
      expect(updated.providers).toHaveLength(1);

      let other = await loadOrganizationFixture(otherOrg.ids);
      await expectServiceError(
        integrationInstanceGroupService.getIntegrationInstanceGroupById({
          instance: other.instance,
          integrationInstanceGroupId: group.id
        }),
        'not_found'
      );

      let archived = await integrationInstanceGroupService.archiveIntegrationInstanceGroup({
        instance,
        auditScope,
        integrationInstanceGroup: updated
      });
      expect(archived.status).toBe('archived');

      let fetchedArchived =
        await integrationInstanceGroupService.getIntegrationInstanceGroupById({
          instance,
          integrationInstanceGroupId: group.id
        });
      await expectServiceError(
        integrationInstanceGroupService.updateIntegrationInstanceGroup({
          instance,
          auditScope,
          integrationInstanceGroup: fetchedArchived,
          input: { name: uniqueId('Renamed') }
        }),
        'gone'
      );
      await expectServiceError(
        integrationInstanceGroupService.archiveIntegrationInstanceGroup({
          instance,
          auditScope,
          integrationInstanceGroup: fetchedArchived
        }),
        'gone'
      );
    },
    providerTestTimeout
  );

  it(
    'archives the group source and group providers of an archived instance',
    async () => {
      let { fixture, integration, integrationProvider } = await attachProvider();
      let { instance, auditScope } = fixture;
      let integrationInstance = await createInstance({
        fixture,
        integration,
        providers: [{ providerId: integrationProvider.id }]
      });
      let [integrationInstanceProvider] = integrationInstance.integrationInstanceProviders;

      let group = await integrationInstanceGroupService.createIntegrationInstanceGroup({
        instance,
        auditScope,
        input: {
          name: uniqueId('Group'),
          providers: [{ integrationInstanceProviderId: integrationInstanceProvider!.id }]
        }
      });

      await integrationInstanceService.archiveIntegrationInstance({
        instance,
        auditScope,
        integrationInstance
      });

      await eventually(async () => {
        let source = await subspaceDb.integrationInstanceGroupSource.findFirstOrThrow({
          where: { integrationInstanceGroupOid: group.oid }
        });
        let provider = await subspaceDb.integrationInstanceGroupProvider.findFirstOrThrow({
          where: { integrationInstanceGroupOid: group.oid }
        });
        expect(source.status).toBe('archived');
        expect(provider.status).toBe('archived');
      }, workerTimeout);
    },
    providerTestTimeout
  );

  it(
    'serves an instance session over MCP that honors the integration provider tool filter',
    async () => {
      let { fixture, integration, integrationProvider } = await attachProvider({
        toolFilters: echoOnlyFilter
      });
      let integrationInstance = await createInstance({
        fixture,
        integration,
        providers: [{ providerId: integrationProvider.id }]
      });

      await eventually(async () => {
        let count = await subspaceDb.sessionTemplateProvider.count({
          where: {
            status: 'active',
            sessionTemplate: {
              defaultSessionTemplateForIntegrationInstanceOid: integrationInstance.oid
            }
          }
        });
        expect(count).toBe(1);
      }, workerTimeout);

      let session = await integrationInstanceService.createSessionForIntegrationInstance({
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        integrationInstance,
        input: { name: uniqueId('Session') }
      });
      let client = connectSession(session.id, org.keys.instanceSecret);

      let init = await client.initialize();
      expect(init.status).toBe(200);

      let tools = (await client.listTools()).result.tools as {
        name: string;
        title?: string;
      }[];
      let echo = findTool(tools, 'echo');
      expect(tools.some(tool => tool.title === 'add' || tool.name.endsWith('_tool_add'))).toBe(
        false
      );

      let text = uniqueId('echo');
      let call = await client.request('tools/call', { name: echo.name, arguments: { text } });
      expect(call.result.content).toEqual([{ type: 'text', text }]);
      expect(server.toolCalls()).toContainEqual(
        expect.objectContaining({ name: 'echo', arguments: { text } })
      );
    },
    providerTestTimeout
  );
});
