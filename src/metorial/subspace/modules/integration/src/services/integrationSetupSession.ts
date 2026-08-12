import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type Brand,
  db,
  type Environment,
  generateRegionalClientSecret,
  getId,
  type Integration,
  type IntegrationSetupSession,
  type IntegrationSetupSessionStatus,
  type ProviderSetupSession,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import {
  providerSetupSessionInclude,
  providerSetupSessionService
} from '@metorial-subspace/module-auth';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { addMinutes } from 'date-fns';
import { normalizeIntegrationProviderToolFilter } from '../lib/versions';
import { integrationProviderVersionInclude } from '../lib/integrationIncludes';
import { getIntegrationToolFilterCapabilities } from './integration';
import {
  integrationInstanceInclude,
  integrationInstanceProviderInclude,
  integrationInstanceService
} from './integrationInstance';
import { integrationInstanceProviderService } from './integrationInstanceProvider';

export let integrationSetupSessionProviderInclude = {
  integrationProvider: {
    include: {
      integration: true,
      provider: {
        include: { listing: true }
      },
      currentVersion: {
        include: integrationProviderVersionInclude
      }
    }
  },
  providerSetupSession: {
    include: providerSetupSessionInclude
  },
  integrationInstanceProvider: {
    include: integrationInstanceProviderInclude
  }
} as const;

export let integrationSetupSessionStepInclude = {
  integrationSetupSessionProvider: {
    include: integrationSetupSessionProviderInclude
  }
} as const;

export let integrationSetupSessionInclude = {
  tenant: true,
  solution: true,
  environment: true,
  integration: true,
  integrationInstance: {
    include: integrationInstanceInclude
  },
  brand: true,
  providers: {
    include: integrationSetupSessionProviderInclude,
    orderBy: { createdAt: 'asc' as const }
  },
  steps: {
    include: integrationSetupSessionStepInclude,
    orderBy: { index: 'asc' as const }
  }
} as const;

let normalizeIntegrationSetupSessionConfiguration = (d: {
  integration: Pick<Integration, 'canAttachCustomToolFilters' | 'canOverrideToolFilters'>;
  configuration?: PrismaJson.ProviderSetupSessionConfiguration | null;
}): PrismaJson.ProviderSetupSessionConfiguration => {
  let capabilities = getIntegrationToolFilterCapabilities(d.integration);

  return {
    providerSearch: {
      groups: d.configuration?.providerSearch?.groups ?? [],
      collections: d.configuration?.providerSearch?.collections ?? [],
      categories: d.configuration?.providerSearch?.categories ?? []
    },
    toolFilters: {
      enabled:
        (d.configuration?.toolFilters?.enabled ?? false) &&
        capabilities.canAttachCustomToolFilters
    },
    ui: {
      layout: d.configuration?.ui?.layout ?? 'box'
    }
  };
};

let getPresentedSetupStatus = (setupSession: ProviderSetupSession | null) => {
  if (!setupSession) return 'pending' as const;
  if (setupSession.status === 'pending' && setupSession.expiresAt <= new Date())
    return 'expired' as const;
  return setupSession.status;
};

export type ListIntegrationSetupSessionsParams = {
  status?: IntegrationSetupSessionStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  integrationIds?: string[];
  integrationInstanceIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetIntegrationSetupSessionByIdParams = {
  integrationSetupSessionId: string;
  allowDeleted?: boolean;
};

export type CreateIntegrationSetupSessionParams = {
  integration: Integration;
  brand?: Brand;
  input: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    identityActorId?: string | null;
    identityId?: string | null;
    expiresAt?: Date;
    redirectUrl?: string;
    configuration?: PrismaJson.ProviderSetupSessionConfiguration | null;
  };
  import: {
    ip: string;
    ua: string;
  };
};

class integrationSetupSessionServiceImpl {
  private async canAutoCreateIntegrationInstanceProviderFromSetupSession(d: {
    setupSession: Pick<IntegrationSetupSession, 'configuration'>;
    providerSetupSession: Pick<ProviderSetupSession, 'oid'>;
  }) {
    let configuration = d.setupSession
      .configuration as PrismaJson.ProviderSetupSessionConfiguration | null;
    if (!configuration?.toolFilters?.enabled) return true;

    let explicitSetupEvent = await db.providerSetupSessionEvent.findFirst({
      where: {
        sessionOid: d.providerSetupSession.oid,
        type: { in: ['config_set', 'auth_config_set'] }
      },
      select: { oid: true }
    });

    return !!explicitSetupEvent;
  }

  async listIntegrationSetupSessions(d: MetorialFacing<ListIntegrationSetupSessionsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listIntegrationSetupSessionsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listIntegrationSetupSessionsInternal(
    d: { tenant: Tenant; environment: Environment } & ListIntegrationSetupSessionsParams
  ) {
    let solution = await getMetorialSolution();

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.integrationSetupSession.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).onlyParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.integrationIds
                  ? { integration: { id: { in: d.integrationIds } } }
                  : undefined!,
                d.integrationInstanceIds
                  ? { integrationInstance: { id: { in: d.integrationInstanceIds } } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: integrationSetupSessionInclude
          })
      )
    );
  }

  async getIntegrationSetupSessionById(
    d: MetorialFacing<GetIntegrationSetupSessionByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getIntegrationSetupSessionByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getIntegrationSetupSessionByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetIntegrationSetupSessionByIdParams
  ) {
    let solution = await getMetorialSolution();

    let integrationSetupSession = await db.integrationSetupSession.findFirst({
      where: {
        id: d.integrationSetupSessionId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: integrationSetupSessionInclude
    });
    if (!integrationSetupSession)
      throw new ServiceError(
        notFoundError('integration.setup_session', d.integrationSetupSessionId)
      );

    if (integrationSetupSession.status === 'pending') {
      await this.reconcileCompletedProviderSetupSessions({
        setupSessionOid: integrationSetupSession.oid
      });

      await this.recalculateIntegrationSetupSessionStatus({
        setupSessionOid: integrationSetupSession.oid
      });

      integrationSetupSession = await db.integrationSetupSession.findFirstOrThrow({
        where: { oid: integrationSetupSession.oid },
        include: integrationSetupSessionInclude
      });
    }

    return integrationSetupSession;
  }

  async getIntegrationSetupSessionByClientSecret(d: {
    sessionId: string;
    clientSecret: string;
  }) {
    let integrationSetupSession = await db.integrationSetupSession.findFirst({
      where: {
        id: d.sessionId,
        clientSecret: d.clientSecret,
        status: { notIn: ['archived', 'deleted'] }
      },
      include: integrationSetupSessionInclude
    });
    if (!integrationSetupSession)
      throw new ServiceError(notFoundError('integration.setup_session'));

    if (integrationSetupSession.status === 'pending') {
      await this.reconcileCompletedProviderSetupSessions({
        setupSessionOid: integrationSetupSession.oid
      });

      await this.recalculateIntegrationSetupSessionStatus({
        setupSessionOid: integrationSetupSession.oid
      });

      integrationSetupSession = await db.integrationSetupSession.findFirstOrThrow({
        where: { oid: integrationSetupSession.oid },
        include: integrationSetupSessionInclude
      });
    }

    return integrationSetupSession;
  }

  async getIntegrationSetupSessionByProviderSetupSession(d: {
    providerSetupSession: Pick<ProviderSetupSession, 'oid'>;
  }) {
    let setupProvider = await db.integrationSetupSessionProvider.findFirst({
      where: {
        providerSetupSessions: { some: { oid: d.providerSetupSession.oid } }
      },
      include: {
        integrationSetupSession: {
          include: integrationSetupSessionInclude
        }
      }
    });

    return setupProvider?.integrationSetupSession ?? null;
  }

  async listIntegrationSetupSessionEvents(d: {
    integrationSetupSession: IntegrationSetupSession;
  }) {
    let [events, providerSetupSessionEvents] = await Promise.all([
      db.integrationSetupSessionEvent.findMany({
        where: { integrationSetupSessionOid: d.integrationSetupSession.oid },
        orderBy: { createdAt: 'asc' }
      }),
      db.providerSetupSessionEvent.findMany({
        where: {
          session: {
            integrationSetupSessionProvider: {
              integrationSetupSessionOid: d.integrationSetupSession.oid
            }
          }
        },
        include: {
          session: {
            select: {
              id: true,
              integrationSetupSessionProvider: {
                select: {
                  id: true,
                  integrationProvider: { select: { id: true } },
                  step: { select: { id: true, index: true } }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    return { events, providerSetupSessionEvents };
  }

  async createIntegrationSetupSession(d: MetorialFacing<CreateIntegrationSetupSessionParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.createIntegrationSetupSessionInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createIntegrationSetupSessionInternal(
    d: { tenant: Tenant; environment: Environment } & CreateIntegrationSetupSessionParams
  ) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.integration);
    checkTenant(d, d.brand);
    checkDeletedRelation(d.integration);
    checkDeletedRelation(d.brand);

    let integration = await db.integration.findFirstOrThrow({
      where: {
        oid: d.integration.oid,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        status: 'active'
      }
    });
    let configuration = normalizeIntegrationSetupSessionConfiguration({
      integration,
      configuration: d.input.configuration
    });
    let expiresAt = d.input.expiresAt ?? addMinutes(new Date(), 30);

    let integrationProviders = await this.getActiveIntegrationProviders({
      integration
    });
    if (!integrationProviders.length) {
      throw new ServiceError(
        badRequestError({
          message: 'Integration setup sessions require at least one active provider.',
          code: 'integration_provider_required'
        })
      );
    }

    let integrationInstance =
      await integrationInstanceService.createIntegrationInstanceInternal({
        tenant: d.tenant,
        environment: d.environment,
        integration,
        isHiddenDraft: true,
        input: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,
          identityActorId: d.input.identityActorId,
          identityId: d.input.identityId
        }
      });

    let setupSession = await db.integrationSetupSession.create({
      data: {
        ...getId('integrationSetupSession'),
        status: 'pending',
        clientSecret: await generateRegionalClientSecret(
          'integrationSetupSession_clientSecret'
        ),
        name: d.input.name?.trim() || undefined,
        description: d.input.description?.trim() || undefined,
        metadata: d.input.metadata,
        privateMetadata: d.input.privateMetadata,
        configuration,
        redirectUrl: d.input.redirectUrl,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        integrationOid: integration.oid,
        integrationInstanceOid: integrationInstance.oid,
        brandOid: d.brand?.oid,
        expiresAt
      }
    });

    await db.integrationSetupSessionEvent.create({
      data: {
        ...getId('integrationSetupSessionEvent'),
        type: 'created',
        integrationSetupSessionOid: setupSession.oid,
        ip: d.import.ip,
        ua: d.import.ua
      }
    });

    for (let [idx, integrationProvider] of integrationProviders.entries()) {
      await this.createChildProviderSetupSession({
        tenant: d.tenant,
        environment: d.environment,
        brand: d.brand,
        integration,
        setupSession,
        integrationProvider,
        configuration,
        expiresAt,
        context: d.import,
        stepIndex: idx
      });
    }

    await this.recalculateIntegrationSetupSessionStatus({
      setupSessionOid: setupSession.oid
    });

    return await db.integrationSetupSession.findUniqueOrThrow({
      where: { oid: setupSession.oid },
      include: integrationSetupSessionInclude
    });
  }

  async startIntegrationSetupSessionProvider(d: {
    integrationSetupSession: IntegrationSetupSession;
    integrationProviderId: string;
    context: { ip: string; ua: string };
  }) {
    return await withTransaction(async db => {
      let setupSession = await db.integrationSetupSession.findFirstOrThrow({
        where: { oid: d.integrationSetupSession.oid },
        include: {
          integration: true,
          brand: true,
          tenant: true,
          solution: true,
          environment: true
        }
      });
      if (setupSession.status !== 'pending') {
        return await db.integrationSetupSession.findUniqueOrThrow({
          where: { oid: setupSession.oid },
          include: integrationSetupSessionInclude
        });
      }
      if (setupSession.expiresAt < new Date()) {
        await db.integrationSetupSession.update({
          where: { oid: setupSession.oid },
          data: { status: 'expired' }
        });

        return await db.integrationSetupSession.findUniqueOrThrow({
          where: { oid: setupSession.oid },
          include: integrationSetupSessionInclude
        });
      }

      let providerRow = await db.integrationSetupSessionProvider.findFirst({
        where: {
          integrationSetupSessionOid: setupSession.oid,
          integrationProvider: { id: d.integrationProviderId }
        },
        include: {
          ...integrationSetupSessionProviderInclude,
          providerSetupSession: true,
          integrationInstanceProvider: true
        }
      });
      if (!providerRow)
        throw new ServiceError(notFoundError('integration.setup_session.provider'));

      if (providerRow.integrationInstanceProviderOid) {
        return await db.integrationSetupSession.findUniqueOrThrow({
          where: { oid: setupSession.oid },
          include: integrationSetupSessionInclude
        });
      }

      let currentStatus = getPresentedSetupStatus(providerRow.providerSetupSession);
      if (providerRow.providerSetupSession && currentStatus === 'completed') {
        await this.reconcileProviderSetupSessionCompleted({
          providerSetupSession: providerRow.providerSetupSession,
          context: d.context
        });

        return await db.integrationSetupSession.findUniqueOrThrow({
          where: { oid: setupSession.oid },
          include: integrationSetupSessionInclude
        });
      }

      if (
        providerRow.providerSetupSession &&
        currentStatus !== 'failed' &&
        currentStatus !== 'expired' &&
        currentStatus !== 'deleted' &&
        currentStatus !== 'archived'
      ) {
        await db.integrationSetupSessionEvent.create({
          data: {
            ...getId('integrationSetupSessionEvent'),
            type: 'provider_started',
            integrationSetupSessionOid: setupSession.oid,
            integrationSetupSessionProviderOid: providerRow.oid,
            ip: d.context.ip,
            ua: d.context.ua
          }
        });

        return await db.integrationSetupSession.findUniqueOrThrow({
          where: { oid: setupSession.oid },
          include: integrationSetupSessionInclude
        });
      }

      let integrationProvider = (
        await this.getActiveIntegrationProviders({
          integration: setupSession.integration,
          integrationProviderOid: providerRow.integrationProviderOid
        })
      )[0];
      if (!integrationProvider)
        throw new ServiceError(notFoundError('integration.provider', d.integrationProviderId));

      await this.createChildProviderSetupSession({
        tenant: setupSession.tenant,
        environment: setupSession.environment,
        brand: setupSession.brand ?? undefined,
        integration: setupSession.integration,
        setupSession,
        integrationProvider,
        configuration:
          setupSession.configuration as PrismaJson.ProviderSetupSessionConfiguration,
        expiresAt: setupSession.expiresAt,
        context: d.context,
        setupSessionProviderOid: providerRow.oid
      });

      return await db.integrationSetupSession.findUniqueOrThrow({
        where: { oid: setupSession.oid },
        include: integrationSetupSessionInclude
      });
    });
  }

  async startIntegrationSetupSessionStep(d: {
    integrationSetupSession: IntegrationSetupSession;
    stepId: string;
    context: { ip: string; ua: string };
  }) {
    let step = await db.integrationSetupSessionStep.findFirst({
      where: {
        id: d.stepId,
        integrationSetupSessionOid: d.integrationSetupSession.oid
      },
      include: {
        integrationSetupSessionProvider: {
          include: {
            integrationProvider: true
          }
        }
      }
    });
    if (!step)
      throw new ServiceError(notFoundError('integration.setup_session.step', d.stepId));

    return await this.startIntegrationSetupSessionProvider({
      integrationSetupSession: d.integrationSetupSession,
      integrationProviderId: step.integrationSetupSessionProvider.integrationProvider.id,
      context: d.context
    });
  }

  async reconcileProviderSetupSessionCompleted(d: {
    providerSetupSession: Pick<ProviderSetupSession, 'oid' | 'status'>;
    context?: { ip: string; ua: string };
  }) {
    if (d.providerSetupSession.status !== 'completed') return null;

    return await withTransaction(async db => {
      let setupProvider = await db.integrationSetupSessionProvider.findFirst({
        where: {
          providerSetupSessions: { some: { oid: d.providerSetupSession.oid } }
        },
        include: {
          integrationSetupSession: {
            include: { integration: true, integrationInstance: true }
          },
          integrationProvider: {
            include: {
              integration: true,
              provider: true,
              currentVersion: {
                include: integrationProviderVersionInclude
              }
            }
          },
          providerSetupSession: {
            include: providerSetupSessionInclude
          },
          integrationInstanceProvider: true
        }
      });
      if (!setupProvider || setupProvider.integrationInstanceProviderOid) return setupProvider;

      let child = setupProvider.providerSetupSession;
      if (!child || child.oid !== d.providerSetupSession.oid) {
        child = await db.providerSetupSession.findUniqueOrThrow({
          where: { oid: d.providerSetupSession.oid },
          include: providerSetupSessionInclude
        });
      }

      if (
        !(await this.canAutoCreateIntegrationInstanceProviderFromSetupSession({
          setupSession: setupProvider.integrationSetupSession,
          providerSetupSession: child
        }))
      ) {
        return await db.integrationSetupSessionProvider.findUniqueOrThrow({
          where: { oid: setupProvider.oid },
          include: integrationSetupSessionProviderInclude
        });
      }

      let integration = setupProvider.integrationSetupSession.integration;
      let capabilities = getIntegrationToolFilterCapabilities(integration);
      let toolFilter = capabilities.canAttachCustomToolFilters
        ? ((child.config?.toolFilter ||
            child.authConfig?.toolFilter ||
            null) as PrismaJson.ToolFilter | null)
        : null;
      let normalizedToolFilter = toolFilter
        ? normalizeIntegrationProviderToolFilter(toolFilter)
        : undefined;
      if (normalizedToolFilter && !capabilities.canOverrideToolFilters) {
        normalizedToolFilter.ignoreParentFilters = undefined;
      }

      let integrationInstanceProvider =
        await integrationInstanceProviderService.setIntegrationInstanceProviderInternal({
          tenant: await db.tenant.findFirstOrThrow({
            where: { oid: setupProvider.integrationSetupSession.tenantOid }
          }),
          environment: await db.environment.findFirstOrThrow({
            where: { oid: setupProvider.integrationSetupSession.environmentOid }
          }),
          integrationInstance: setupProvider.integrationSetupSession.integrationInstance,
          input: {
            providerId: setupProvider.integrationProvider.id,
            providerConfigId:
              child.config?.id ?? setupProvider.integrationProvider.currentVersion?.config?.id,
            providerAuthConfigId: child.authConfig?.id ?? undefined,
            lockProviderResources: true,
            ...(normalizedToolFilter ? { toolFilters: normalizedToolFilter } : {}),
            ...(normalizedToolFilter?.ignoreParentFilters !== undefined
              ? { isOverrideToolFilter: !!normalizedToolFilter.ignoreParentFilters }
              : {})
          }
        });

      await db.integrationSetupSessionProvider.update({
        where: { oid: setupProvider.oid },
        data: { integrationInstanceProviderOid: integrationInstanceProvider.oid }
      });

      await db.integrationSetupSessionEvent.create({
        data: {
          ...getId('integrationSetupSessionEvent'),
          type: 'provider_completed',
          integrationSetupSessionOid: setupProvider.integrationSetupSessionOid,
          integrationSetupSessionProviderOid: setupProvider.oid,
          ip: d.context?.ip,
          ua: d.context?.ua
        }
      });

      await this.recalculateIntegrationSetupSessionStatus({
        setupSessionOid: setupProvider.integrationSetupSessionOid,
        context: d.context
      });

      return await db.integrationSetupSessionProvider.findUniqueOrThrow({
        where: { oid: setupProvider.oid },
        include: integrationSetupSessionProviderInclude
      });
    });
  }

  private async reconcileCompletedProviderSetupSessions(d: { setupSessionOid: bigint }) {
    let completedProviders = await db.integrationSetupSessionProvider.findMany({
      where: {
        integrationSetupSessionOid: d.setupSessionOid,
        integrationInstanceProviderOid: null,
        providerSetupSession: {
          status: 'completed'
        }
      },
      include: {
        providerSetupSession: true
      }
    });

    for (let provider of completedProviders) {
      if (!provider.providerSetupSession) continue;

      await this.reconcileProviderSetupSessionCompleted({
        providerSetupSession: provider.providerSetupSession
      });
    }
  }

  private async getActiveIntegrationProviders(d: {
    integration: Pick<Integration, 'oid'>;
    integrationProviderOid?: bigint;
  }) {
    return await db.integrationProvider.findMany({
      where: {
        oid: d.integrationProviderOid,
        integrationOid: d.integration.oid,
        status: 'active',
        currentVersionOid: { not: null }
      },
      include: {
        integration: true,
        provider: { include: { defaultVariant: true, type: true } },
        currentVersion: {
          include: {
            ...integrationProviderVersionInclude,
            deployment: {
              include: {
                provider: true,
                providerVariant: true,
                currentVersion: { include: { lockedVersion: true } }
              }
            },
            config: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  private async createChildProviderSetupSession(d: {
    tenant: Tenant;
    environment: Environment;
    brand?: Brand | null;
    integration: Pick<Integration, 'canAttachCustomToolFilters' | 'canOverrideToolFilters'>;
    setupSession: Pick<IntegrationSetupSession, 'oid' | 'name' | 'description' | 'metadata'>;
    integrationProvider: Awaited<
      ReturnType<integrationSetupSessionServiceImpl['getActiveIntegrationProviders']>
    >[number];
    configuration: PrismaJson.ProviderSetupSessionConfiguration | null;
    expiresAt: Date;
    context: { ip: string; ua: string };
    setupSessionProviderOid?: bigint;
    stepIndex?: number;
  }) {
    let setupSessionProviderOid =
      d.setupSessionProviderOid ??
      (
        await db.integrationSetupSessionProvider.create({
          data: {
            ...getId('integrationSetupSessionProvider'),
            integrationSetupSessionOid: d.setupSession.oid,
            integrationProviderOid: d.integrationProvider.oid
          }
        })
      ).oid;

    let existingStep = await db.integrationSetupSessionStep.findUnique({
      where: { integrationSetupSessionProviderOid: setupSessionProviderOid }
    });
    let stepIndex = d.stepIndex ?? existingStep?.index;

    if (stepIndex === undefined) {
      let lastStep = await db.integrationSetupSessionStep.findFirst({
        where: { integrationSetupSessionOid: d.setupSession.oid },
        orderBy: { index: 'desc' },
        select: { index: true }
      });
      stepIndex = (lastStep?.index ?? -1) + 1;
    }

    if (!existingStep) {
      await db.integrationSetupSessionStep.create({
        data: {
          ...getId('integrationSetupSessionStep'),
          index: stepIndex,
          integrationSetupSessionOid: d.setupSession.oid,
          integrationSetupSessionProviderOid: setupSessionProviderOid
        }
      });
    } else if (d.stepIndex !== undefined && existingStep.index !== d.stepIndex) {
      await db.integrationSetupSessionStep.update({
        where: { oid: existingStep.oid },
        data: { index: d.stepIndex }
      });
    }

    let material = d.integrationProvider.currentVersion!;
    let configuration = normalizeIntegrationSetupSessionConfiguration({
      integration: d.integration,
      configuration: d.configuration
    });

    let child = await providerSetupSessionService.createProviderSetupSessionInternal({
      tenant: d.tenant,
      environment: d.environment,
      brand: d.brand ?? undefined,
      provider: d.integrationProvider.provider,
      providerDeployment: material.deployment,
      providerConfig: material.config ?? undefined,
      credentials: material.authCredentials ?? undefined,
      input: {
        name: d.setupSession.name ?? d.integrationProvider.name,
        description:
          d.setupSession.description ?? d.integrationProvider.description ?? undefined,
        metadata: d.setupSession.metadata as Record<string, any> | undefined,
        expiresAt: d.expiresAt,
        type: 'auto',
        uiMode: 'metorial_elements',
        authMethodId: material.authMethod?.id,
        configuration
      },
      import: d.context,
      internal: {
        integrationSetupSessionProviderOid: setupSessionProviderOid
      }
    });

    await db.integrationSetupSessionProvider.update({
      where: { oid: setupSessionProviderOid },
      data: { providerSetupSessionOid: child.oid }
    });

    await db.integrationSetupSessionEvent.create({
      data: {
        ...getId('integrationSetupSessionEvent'),
        type: 'provider_started',
        integrationSetupSessionOid: d.setupSession.oid,
        integrationSetupSessionProviderOid: setupSessionProviderOid,
        ip: d.context.ip,
        ua: d.context.ua
      }
    });

    if (child.status === 'completed') {
      await this.reconcileProviderSetupSessionCompleted({
        providerSetupSession: child,
        context: d.context
      });
    }

    return child;
  }

  private async recalculateIntegrationSetupSessionStatus(d: {
    setupSessionOid: bigint;
    context?: { ip: string; ua: string };
  }) {
    let setupSession = await db.integrationSetupSession.findUniqueOrThrow({
      where: { oid: d.setupSessionOid },
      include: { providers: true }
    });

    if (setupSession.status !== 'pending') return setupSession;

    if (setupSession.expiresAt < new Date()) {
      return await db.integrationSetupSession.update({
        where: { oid: setupSession.oid },
        data: { status: 'expired' }
      });
    }

    if (
      setupSession.providers.length > 0 &&
      setupSession.providers.every(
        provider => provider.integrationInstanceProviderOid !== null
      )
    ) {
      let updated = await db.integrationSetupSession.update({
        where: { oid: setupSession.oid },
        data: { status: 'successful' }
      });

      await db.integrationSetupSessionEvent.create({
        data: {
          ...getId('integrationSetupSessionEvent'),
          type: 'completed',
          integrationSetupSessionOid: setupSession.oid,
          ip: d.context?.ip,
          ua: d.context?.ua
        }
      });

      return updated;
    }

    return setupSession;
  }
}

export let integrationSetupSessionService = Service.create(
  'integrationSetupSession',
  () => new integrationSetupSessionServiceImpl()
).build();
