import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type IntegrationInstance,
  type IntegrationInstanceGroup,
  type SessionTemplate,
  type SessionTemplateProvider,
  type SessionTemplateProviderStatus,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIntegrationInstanceGroupProviders,
  resolveIntegrationInstanceGroups,
  resolveIntegrationInstanceProviders,
  resolveIntegrationInstances,
  resolveIntegrationProviders,
  resolveIntegrations,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  resolveProviderDeployments,
  resolveProviders,
  resolveSessionTemplates
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  enqueueSessionTemplateProvidersCreated,
  enqueueSessionTemplateSyncHash
} from '../queues/lifecycle/sessionTemplateProvider';
import { withSessionTemplateSyncLock } from '../lib/sessionTemplateSync';
import {
  type SessionProviderInput,
  sessionProviderInputService,
  type SessionProviderInputToolFilters
} from './sessionProviderInput';

let include = {
  provider: true,
  deployment: true,
  config: true,
  authConfig: true,
  integrationInstanceProvider: true,
  integrationInstanceGroupProvider: true,
  sessionTemplate: {
    include: {
      integrationInstance: true,
      integrationInstanceGroup: true
    }
  }
};
export let sessionTemplateProviderInclude = include;

let allowAllToolFilter = (): PrismaJson.ToolFilter => ({ type: 'v1.allow_all' });

let assertCanWriteSessionTemplateProvider = (
  provider: Pick<SessionTemplateProvider, 'integrationInstanceProviderOid'> & {
    integrationInstanceGroupProviderOid?: bigint | null;
    sessionTemplate?: Pick<
      SessionTemplate,
      'integrationInstanceOid' | 'integrationInstanceGroupOid'
    > | null;
  },
  action: 'create' | 'update' | 'archive'
) => {
  if (
    !provider.integrationInstanceProviderOid &&
    !provider.integrationInstanceGroupProviderOid &&
    !provider.sessionTemplate?.integrationInstanceOid &&
    !provider.sessionTemplate?.integrationInstanceGroupOid
  ) {
    return;
  }

  throw new ServiceError(
    badRequestError({
      message: `Cannot ${action} an integration-linked session template provider.`,
      code: 'integration_instance_linked_session_template_provider_readonly'
    })
  );
};

class sessionTemplateProviderServiceImpl {
  async listSessionTemplateProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: SessionTemplateProviderStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    sessionTemplateIds?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
    integrationIds?: string[];
    integrationInstanceIds?: string[];
    integrationInstanceGroupIds?: string[];
    integrationProviderIds?: string[];
    integrationInstanceProviderIds?: string[];
    integrationInstanceGroupProviderIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let sessionTemplates = await resolveSessionTemplates(d, d.sessionTemplateIds);
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);
    let integrations = await resolveIntegrations(d, d.integrationIds);
    let integrationInstances = await resolveIntegrationInstances(d, d.integrationInstanceIds);
    let integrationInstanceGroups = await resolveIntegrationInstanceGroups(
      d,
      d.integrationInstanceGroupIds
    );
    let integrationProviders = await resolveIntegrationProviders(d, d.integrationProviderIds);
    let integrationInstanceProviders = await resolveIntegrationInstanceProviders(
      d,
      d.integrationInstanceProviderIds
    );
    let integrationInstanceGroupProviders = await resolveIntegrationInstanceGroupProviders(
      d,
      d.integrationInstanceGroupProviderIds
    );

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionTemplateProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              sessionTemplate: sessionTemplates?.oids.length
                ? undefined
                : { isInternal: false },

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                sessionTemplates ? { sessionTemplateOid: sessionTemplates.in } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                configs ? { configOid: configs.in } : undefined!,
                authConfigs ? { authConfigOid: authConfigs.in } : undefined!,
                integrations
                  ? {
                      OR: [
                        {
                          sessionTemplate: {
                            integrationInstance: {
                              integrationOid: integrations.in
                            }
                          }
                        },
                        {
                          integrationInstanceProvider: {
                            integrationOid: integrations.in
                          }
                        }
                      ]
                    }
                  : undefined!,
                integrationInstances
                  ? {
                      OR: [
                        {
                          sessionTemplate: {
                            integrationInstanceOid: integrationInstances.in
                          }
                        },
                        {
                          integrationInstanceProvider: {
                            integrationInstanceOid: integrationInstances.in
                          }
                        }
                      ]
                    }
                  : undefined!,
                integrationInstanceGroups
                  ? {
                      OR: [
                        {
                          sessionTemplate: {
                            integrationInstanceGroupOid: integrationInstanceGroups.in
                          }
                        },
                        {
                          integrationInstanceGroupProvider: {
                            integrationInstanceGroupOid: integrationInstanceGroups.in
                          }
                        }
                      ]
                    }
                  : undefined!,
                integrationProviders
                  ? {
                      integrationInstanceProvider: {
                        integrationProviderOid: integrationProviders.in
                      }
                    }
                  : undefined!,
                integrationInstanceProviders
                  ? {
                      integrationInstanceProviderOid: integrationInstanceProviders.in
                    }
                  : undefined!,
                integrationInstanceGroupProviders
                  ? {
                      integrationInstanceGroupProviderOid: integrationInstanceGroupProviders.in
                    }
                  : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getSessionTemplateProviderById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionTemplateProviderId: string;
    allowDeleted?: boolean;
  }) {
    let sessionProvider = await db.sessionTemplateProvider.findFirst({
      where: {
        id: d.sessionTemplateProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
    if (!sessionProvider)
      throw new ServiceError(
        notFoundError('session.template.provider', d.sessionTemplateProviderId)
      );

    return sessionProvider;
  }

  async getManySessionTemplateProvidersBySessionTemplateIds(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionTemplateIds: string[];
    status?: SessionTemplateProviderStatus[];
    allowDeleted?: boolean;
  }) {
    let sessionTemplates = await resolveSessionTemplates(d, d.sessionTemplateIds);

    return await db.sessionTemplateProvider.findMany({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent,
        AND: [
          sessionTemplates ? { sessionTemplateOid: sessionTemplates.in } : undefined!
        ].filter(Boolean)
      },
      include
    });
  }

  async syncForIntegrationInstance(d: {
    sessionTemplate: SessionTemplate;
    integrationInstance: IntegrationInstance;
  }) {
    await withSessionTemplateSyncLock(d.sessionTemplate.id, async () => {
      await withTransaction(async db => {
        let instanceProviders = await db.integrationInstanceProvider.findMany({
          where: {
            integrationInstanceOid: d.integrationInstance.oid,
            status: 'active',
            isParentDeleted: false,
            currentVersion: { configOid: { not: null } }
          },
          orderBy: { id: 'asc' },
          include: {
            integration: true,
            integrationProvider: true,
            currentVersion: {
              include: {
                integrationProviderVersion: true
              }
            }
          }
        });

        let activeProviderOids = instanceProviders.map(provider => provider.oid);
        let createdIds: string[] = [];

        let existingProviders = await db.sessionTemplateProvider.findMany({
          where: {
            sessionTemplateOid: d.sessionTemplate.oid,
            integrationInstanceProviderOid: { in: activeProviderOids }
          },
          select: {
            id: true,
            integrationInstanceProviderOid: true
          }
        });
        let existingByProviderOid = new Map(
          existingProviders.map(provider => [
            provider.integrationInstanceProviderOid!.toString(),
            provider
          ])
        );

        for (let provider of instanceProviders) {
          let currentVersion = provider.currentVersion!;
          let data = {
            status: 'active' as const,
            toolFilter:
              (currentVersion.toolFilter as PrismaJson.ToolFilter | null) ??
              allowAllToolFilter(),
            sessionTemplateOid: d.sessionTemplate.oid,
            providerOid: provider.integrationProvider.providerOid,
            deploymentOid: currentVersion.integrationProviderVersion.deploymentOid,
            configOid: currentVersion.configOid!,
            authConfigOid: currentVersion.authConfigOid,
            integrationInstanceProviderOid: provider.oid,
            tenantOid: provider.tenantOid,
            solutionOid: provider.solutionOid,
            environmentOid: provider.environmentOid
          };

          let createdBefore = existingByProviderOid.has(provider.oid.toString());
          let synced = await db.sessionTemplateProvider.upsert({
            where: {
              sessionTemplateOid_integrationInstanceProviderOid: {
                sessionTemplateOid: d.sessionTemplate.oid,
                integrationInstanceProviderOid: provider.oid
              }
            },
            create: {
              ...getId('sessionTemplateProvider'),
              ...data
            },
            update: data,
            select: { id: true }
          });
          if (!createdBefore) createdIds.push(synced.id);
        }

        await db.sessionTemplateProvider.updateMany({
          where: {
            sessionTemplateOid: d.sessionTemplate.oid,
            status: 'active',
            OR: [
              { integrationInstanceProviderOid: null },
              {
                integrationInstanceProviderOid: {
                  notIn: activeProviderOids
                }
              }
            ]
          },
          data: { status: 'archived' }
        });

        await addAfterTransactionHook(async () =>
          enqueueSessionTemplateProvidersCreated(createdIds)
        );
      });
    });
  }

  async syncForIntegrationInstanceGroup(d: {
    sessionTemplate: SessionTemplate;
    integrationInstanceGroup: IntegrationInstanceGroup;
  }) {
    await withSessionTemplateSyncLock(d.sessionTemplate.id, async () => {
      await withTransaction(async db => {
        let groupProviders = await db.integrationInstanceGroupProvider.findMany({
          where: {
            integrationInstanceGroupOid: d.integrationInstanceGroup.oid,
            status: 'active',
            isParentDeleted: false,
            integrationInstanceProvider: {
              status: 'active',
              isParentDeleted: false,
              currentVersion: { configOid: { not: null } }
            }
          },
          orderBy: { id: 'asc' },
          include: {
            integrationProvider: true,
            integrationInstanceProvider: {
              include: {
                currentVersion: {
                  include: {
                    integrationProviderVersion: true
                  }
                }
              }
            }
          }
        });

        let activeProviderOids = groupProviders.map(provider => provider.oid);
        let activeInstanceProviderOids = groupProviders.map(
          provider => provider.integrationInstanceProviderOid
        );
        let createdIds: string[] = [];

        let existingProviders = await db.sessionTemplateProvider.findMany({
          where: {
            sessionTemplateOid: d.sessionTemplate.oid,
            OR: [
              { integrationInstanceGroupProviderOid: { in: activeProviderOids } },
              { integrationInstanceProviderOid: { in: activeInstanceProviderOids } }
            ]
          },
          select: {
            oid: true,
            id: true,
            integrationInstanceProviderOid: true,
            integrationInstanceGroupProviderOid: true
          }
        });
        let existingByGroupProviderOid = new Map(
          existingProviders
            .filter(provider => provider.integrationInstanceGroupProviderOid)
            .map(provider => [
              provider.integrationInstanceGroupProviderOid!.toString(),
              provider
            ])
        );
        let existingByInstanceProviderOid = new Map(
          existingProviders
            .filter(provider => provider.integrationInstanceProviderOid)
            .map(provider => [provider.integrationInstanceProviderOid!.toString(), provider])
        );

        let freeGroupProviderIdentity = async (input: {
          groupProviderOid: bigint;
          exceptSessionTemplateProviderOid?: bigint;
        }) => {
          await db.sessionTemplateProvider.updateMany({
            where: {
              sessionTemplateOid: d.sessionTemplate.oid,
              integrationInstanceGroupProviderOid: input.groupProviderOid,
              oid: input.exceptSessionTemplateProviderOid
                ? { not: input.exceptSessionTemplateProviderOid }
                : undefined
            },
            data: {
              status: 'archived',
              integrationInstanceGroupProviderOid: null
            }
          });
        };

        let updateOrCreateByInstanceProvider = async (d: {
          existing?: (typeof existingProviders)[number];
          data: {
            status: 'active';
            toolFilter: PrismaJson.ToolFilter;
            sessionTemplateOid: bigint;
            providerOid: bigint;
            deploymentOid: bigint;
            configOid: bigint;
            authConfigOid: bigint | null;
            integrationInstanceProviderOid: bigint;
            integrationInstanceGroupProviderOid: bigint;
            tenantOid: bigint;
            solutionOid: number;
            environmentOid: bigint;
          };
        }) => {
          if (d.existing) {
            await freeGroupProviderIdentity({
              groupProviderOid: d.data.integrationInstanceGroupProviderOid,
              exceptSessionTemplateProviderOid: d.existing.oid
            });

            return await db.sessionTemplateProvider.update({
              where: { oid: d.existing.oid },
              data: d.data,
              select: { id: true }
            });
          }

          await freeGroupProviderIdentity({
            groupProviderOid: d.data.integrationInstanceGroupProviderOid
          });

          return await db.sessionTemplateProvider.upsert({
            where: {
              sessionTemplateOid_integrationInstanceProviderOid: {
                sessionTemplateOid: d.data.sessionTemplateOid,
                integrationInstanceProviderOid: d.data.integrationInstanceProviderOid
              }
            },
            create: {
              ...getId('sessionTemplateProvider'),
              ...d.data
            },
            update: d.data,
            select: { id: true }
          });
        };

        for (let provider of groupProviders) {
          let currentVersion = provider.integrationInstanceProvider.currentVersion!;
          let data = {
            status: 'active' as const,
            toolFilter:
              (provider.toolFilter as PrismaJson.ToolFilter | null) ?? allowAllToolFilter(),
            sessionTemplateOid: d.sessionTemplate.oid,
            providerOid: provider.integrationProvider.providerOid,
            deploymentOid: currentVersion.integrationProviderVersion.deploymentOid,
            configOid: currentVersion.configOid!,
            authConfigOid: currentVersion.authConfigOid,
            integrationInstanceProviderOid: provider.integrationInstanceProviderOid,
            integrationInstanceGroupProviderOid: provider.oid,
            tenantOid: provider.tenantOid,
            solutionOid: provider.solutionOid,
            environmentOid: provider.environmentOid
          };

          let existing =
            existingByInstanceProviderOid.get(
              provider.integrationInstanceProviderOid.toString()
            ) ?? existingByGroupProviderOid.get(provider.oid.toString());
          let createdBefore = !!existing;
          let synced = await updateOrCreateByInstanceProvider({ existing, data });
          if (!createdBefore) createdIds.push(synced.id);
        }

        await db.sessionTemplateProvider.updateMany({
          where: {
            sessionTemplateOid: d.sessionTemplate.oid,
            status: 'active',
            OR: [
              { integrationInstanceGroupProviderOid: null },
              {
                integrationInstanceGroupProviderOid: {
                  notIn: activeProviderOids
                }
              }
            ]
          },
          data: { status: 'archived' }
        });

        await addAfterTransactionHook(async () =>
          enqueueSessionTemplateProvidersCreated(createdIds)
        );
      });
    });
  }

  async createSessionTemplateProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    template: SessionTemplate;
    input: SessionProviderInput;
    _allowLinked?: boolean;
  }) {
    checkDeletedRelation(d.template);
    if (!d._allowLinked) {
      assertCanWriteSessionTemplateProvider(
        {
          integrationInstanceProviderOid: null,
          sessionTemplate: d.template
        },
        'create'
      );
    }

    let [res] = await sessionProviderInputService.createSessionTemplateProvidersForInput({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,

      template: d.template,
      providers: [d.input]
    });

    return res!;
  }

  async updateSessionTemplateProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionTemplateProvider: SessionTemplateProvider;
    input: {
      toolFilters?: SessionProviderInputToolFilters;
    };
    _allowLinked?: boolean;
  }) {
    checkTenant(d, d.sessionTemplateProvider);
    checkDeletedEdit(d.sessionTemplateProvider, 'update');
    if (!d._allowLinked) {
      assertCanWriteSessionTemplateProvider(d.sessionTemplateProvider, 'update');
    }

    let sessionTemplateProvider = await db.sessionTemplateProvider.update({
      where: {
        oid: d.sessionTemplateProvider.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      data: {
        toolFilter: d.input.toolFilters ?? undefined
      },
      include
    });

    await enqueueSessionTemplateSyncHash(sessionTemplateProvider.sessionTemplate.id);

    return sessionTemplateProvider;
  }

  async archiveSessionTemplateProvider(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionTemplateProvider: SessionTemplateProvider;
    _allowLinked?: boolean;
  }) {
    checkTenant(d, d.sessionTemplateProvider);
    checkDeletedEdit(d.sessionTemplateProvider, 'archive');
    if (!d._allowLinked) {
      assertCanWriteSessionTemplateProvider(d.sessionTemplateProvider, 'archive');
    }

    let sessionTemplateProvider = await db.sessionTemplateProvider.update({
      where: {
        oid: d.sessionTemplateProvider.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      data: {
        status: 'archived' as const
      },
      include
    });

    await enqueueSessionTemplateSyncHash(sessionTemplateProvider.sessionTemplate.id);

    return sessionTemplateProvider;
  }
}

export let sessionTemplateProviderService = Service.create(
  'sessionProvider',
  () => new sessionTemplateProviderServiceImpl()
).build();
