import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  snowflake,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  ephemeralManagedSessionService,
  sessionTemplateService
} from '@metorial-subspace/module-session';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { integrationService } from '../integration';
import { integrationInstanceService } from '../integrationInstance';
import { integrationInstanceProviderService } from '../integrationInstanceProvider';
import {
  enqueueMagicMcpServerBackingReconcile,
  reconcileMagicMcpServerBacking
} from '../../queues/lifecycle/magicMcpBackingReconcile';
import {
  type BackingProviderInput,
  type MagicMcpBackingInputBase,
  type MagicMcpOwnerType,
  magicMcpProviderTemplateBackingInclude,
  magicMcpServerBackingInclude,
  resolveMagicMcpBackingPolicy,
  resolveActorOid,
  withMagicMcpBackingLock
} from './shared';

type UpsertMagicMcpServerBackingInput = {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  input: MagicMcpBackingInputBase & {
    providerTemplateBackingId?: string | null;
    ownerIntegrationId?: string | null;
    ownerIntegrationInstanceId?: string | null;
    providers?: BackingProviderInput[];
    legacySessionTemplateId?: string | null;
    isReconciliation?: boolean;
    deferReconcile?: boolean;
  };
};

class magicMcpServerBackingServiceImpl {
  private async getLegacyProvidersFromSessionTemplate(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionTemplateId?: string | null;
  }): Promise<BackingProviderInput[]> {
    if (!d.sessionTemplateId) return [];

    let providers = await db.sessionTemplateProvider.findMany({
      where: {
        status: 'active',
        sessionTemplate: {
          id: d.sessionTemplateId,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: {
        deployment: true,
        config: true,
        authConfig: true
      }
    });

    return providers.map(provider => ({
      providerDeploymentId: provider.deployment.id,
      providerConfigId: provider.config.id,
      providerAuthConfigId: provider.authConfig?.id ?? null,
      toolFilters: provider.toolFilter as PrismaJson.ToolFilter
    }));
  }

  async upsertMagicMcpServerBacking(d: UpsertMagicMcpServerBackingInput) {
    let actorOid = await resolveActorOid({
      ...d,
      identityActorId: d.input.identityActorId,
      identityId: d.input.identityId
    });
    if (d.input.providerTemplateBackingId && d.input.ownerIntegrationId) {
      throw new ServiceError(
        notFoundError(
          'magic_mcp.server_backing',
          'Cannot assign both providerTemplateBackingId and ownerIntegrationId.'
        )
      );
    }
    let providerTemplateBacking = d.input.providerTemplateBackingId
      ? await db.providerTemplateBacking.findUnique({
          where: { id: d.input.providerTemplateBackingId },
          include: magicMcpProviderTemplateBackingInclude
        })
      : null;
    if (d.input.providerTemplateBackingId && !providerTemplateBacking) {
      throw new ServiceError(
        notFoundError('provider_template', d.input.providerTemplateBackingId)
      );
    }
    let ownerIntegration = d.input.ownerIntegrationId
      ? await integrationService.getIntegrationById({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          integrationId: d.input.ownerIntegrationId
        })
      : null;
    let ownerIntegrationInstance = d.input.ownerIntegrationInstanceId
      ? await db.integrationInstance.findFirst({
          where: {
            id: d.input.ownerIntegrationInstanceId,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            status: { notIn: ['deleted', 'archived'] }
          },
          include: {
            integration: true
          }
        })
      : null;
    if (d.input.ownerIntegrationInstanceId && !ownerIntegrationInstance) {
      throw new ServiceError(
        notFoundError('integration.instance', d.input.ownerIntegrationInstanceId)
      );
    }
    if (ownerIntegrationInstance && ownerIntegrationInstance.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Magic MCP server backing requires an active integration instance.',
          code: 'integration_instance_not_active',
          data: {
            integration_instance_id: ownerIntegrationInstance.id,
            status: ownerIntegrationInstance.status
          }
        })
      );
    }
    if (
      ownerIntegrationInstance &&
      providerTemplateBacking &&
      ownerIntegrationInstance.integrationOid !== providerTemplateBacking.integrationOid
    ) {
      throw new ServiceError(
        badRequestError({
          message:
            'Integration instance does not belong to the selected provider template backing.',
          code: 'integration_instance_provider_template_mismatch'
        })
      );
    }
    if (
      ownerIntegrationInstance &&
      ownerIntegration &&
      ownerIntegrationInstance.integrationOid !== ownerIntegration.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Integration instance does not belong to the selected owner integration.',
          code: 'integration_instance_owner_mismatch'
        })
      );
    }
    let ownerType =
      providerTemplateBacking?.id != null
        ? ('provider_template' as const)
        : ownerIntegration?.id != null
          ? ('integration' as const)
          : ('server_owned' as const);

    let providers =
      d.input.providers ??
      (d.input.isReconciliation
        ? await this.getLegacyProvidersFromSessionTemplate({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            sessionTemplateId: d.input.legacySessionTemplateId
          })
        : []);

    let shouldRunReconcile =
      providers.length > 0 || ownerType !== 'server_owned' || d.input.deferReconcile === false;
    let shouldDeferReconcile = d.input.deferReconcile !== false && shouldRunReconcile;

    let syncTarget = await withMagicMcpBackingLock(
      `server:${d.input.id}`,
      async () =>
        await withTransaction(async db => {
          let existing = await db.magicMcpServerBacking.findUnique({
            where: { id: d.input.id },
            include: {
              integration: true,
              integrationInstance: true,
              sessionTemplate: true,
              ephemeralManagedSession: true
            }
          });

          let integration =
            providerTemplateBacking?.integration ??
            ownerIntegration ??
            ownerIntegrationInstance?.integration ??
            existing?.integration;
          if (ownerType === 'server_owned') {
            integration = await integrationService.upsertMagicMcpIntegration({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              integration,
              input: {
                slug: `magic-mcp-server-${d.input.id}`,
                name: d.input.name?.trim() || d.input.id,
                description: d.input.description,
                metadata: d.input.metadata,
                privateMetadata: d.input.privateMetadata,
                canAttachCustomToolFilters: true,
                canAttachCustomProviderConfig: true,
                canOverrideToolFilters: true
              }
            });
          }
          if (!integration) {
            throw new ServiceError(notFoundError('integration'));
          }

          let integrationInstance =
            ownerIntegrationInstance ??
            (await integrationInstanceService.upsertMagicMcpIntegrationInstance({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              integration,
              integrationInstance: existing?.integrationInstance,
              input: {
                name: d.input.name?.trim() || d.input.id,
                description: d.input.description,
                metadata: d.input.metadata,
                privateMetadata: d.input.privateMetadata,
                identityActorId: d.input.identityActorId,
                identityId: d.input.identityId
              }
            }));

          let sessionTemplate =
            await sessionTemplateService.upsertInternalLinkedSessionTemplate({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              sessionTemplate: existing?.sessionTemplate,
              linkAsDefault: false,
              input: {
                name: d.input.name?.trim() || d.input.id,
                description: d.input.description,
                metadata: d.input.metadata,
                privateMetadata: d.input.privateMetadata,
                integrationInstance
              }
            });

          let ephemeralManagedSession =
            await ephemeralManagedSessionService.upsertPlaceholderEphemeralManagedSession({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              ephemeralManagedSession: existing?.ephemeralManagedSession,
              sessionTemplate,
              input: {
                maxSessionDurationInMinutes: d.input.maxSessionDurationInMinutes,
                actorOid,
                isReconciling: shouldDeferReconcile
              }
            });

          let backing = await db.magicMcpServerBacking.upsert({
            where: { id: d.input.id },
            create: {
              oid: snowflake.nextId(),
              id: d.input.id,
              ownerType,
              providerTemplateBackingOid: providerTemplateBacking?.oid,
              ownerIntegrationOid: ownerType === 'integration' ? integration.oid : null,
              integrationOid: ownerType === 'server_owned' ? integration.oid : null,
              integrationInstanceOid: integrationInstance.oid,
              sessionTemplateOid: sessionTemplate.oid,
              ephemeralManagedSessionOid: ephemeralManagedSession.oid,
              actorOid
            },
            update: {
              ownerType,
              providerTemplateBackingOid: providerTemplateBacking?.oid ?? null,
              ownerIntegrationOid: ownerType === 'integration' ? integration.oid : null,
              integrationOid: ownerType === 'server_owned' ? integration.oid : null,
              integrationInstanceOid: integrationInstance.oid,
              sessionTemplateOid: sessionTemplate.oid,
              ephemeralManagedSessionOid: ephemeralManagedSession.oid,
              actorOid
            }
          });

          return {
            backing,
            integration,
            integrationInstance,
            sessionTemplate,
            ephemeralManagedSession
          };
        })
    );

    if (providers.length) {
      await integrationInstanceProviderService.setMagicMcpIntegrationInstanceProviders({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integration: syncTarget.integration,
        integrationInstance: syncTarget.integrationInstance,
        isReconciliation: d.input.isReconciliation,
        input: providers
      });
    }

    if (shouldDeferReconcile) {
      await enqueueMagicMcpServerBackingReconcile({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpServerBackingId: d.input.id
      });
    } else if (shouldRunReconcile) {
      await reconcileMagicMcpServerBacking({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpServerBackingId: d.input.id
      });
    }

    return {
      ...syncTarget.backing,
      providerTemplateBacking,
      ownerIntegration: ownerType === 'integration' ? syncTarget.integration : null,
      integration: ownerType === 'server_owned' ? syncTarget.integration : null,
      integrationInstance: syncTarget.integrationInstance,
      sessionTemplate: syncTarget.sessionTemplate,
      ephemeralManagedSession: syncTarget.ephemeralManagedSession,
      actor: null
    };
  }

  async getMagicMcpServerBackingById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpServerBackingId: string;
  }) {
    let backing = await db.magicMcpServerBacking.findFirst({
      where: {
        id: d.magicMcpServerBackingId,
        integrationInstance: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: magicMcpServerBackingInclude
    });
    if (!backing) {
      throw new ServiceError(
        notFoundError('magic_mcp.server_backing', d.magicMcpServerBackingId)
      );
    }

    return backing;
  }

  async archiveMagicMcpServerBacking(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpServerBackingId: string;
  }) {
    let backing = await this.getMagicMcpServerBackingById(d);
    checkTenant(d, backing.integrationInstance);

    let policy = resolveMagicMcpBackingPolicy(backing);
    let archivedAt = new Date();

    await db.magicMcpServerProvider.updateMany({
      where: {
        magicMcpServerBackingOid: backing.oid,
        status: { in: ['pending', 'active'] }
      },
      data: {
        status: 'archived',
        archivedAt
      }
    });

    if (
      policy.archivesIntegrationInstance &&
      !['archived', 'deleted'].includes(backing.integrationInstance.status)
    ) {
      await integrationInstanceService.archiveIntegrationInstance({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integrationInstance: backing.integrationInstance,
        _canModifyMagicMcpBacking: true
      });
    }
    if (
      policy.archivesIntegration &&
      backing.integration &&
      !['archived', 'deleted'].includes(backing.integration.status)
    ) {
      await integrationService.archiveIntegration({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integration: backing.integration,
        _canModifyMagicMcpBacking: true
      });
    }
    if (!['archived', 'deleted'].includes(backing.sessionTemplate.status)) {
      await sessionTemplateService.archiveSessionTemplate({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        sessionTemplate: backing.sessionTemplate,
        _allowLinked: true
      });
    }

    if (!['archived', 'deleted'].includes(backing.ephemeralManagedSession.status)) {
      await ephemeralManagedSessionService.archiveEphemeralManagedSession({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        ephemeralManagedSession:
          await ephemeralManagedSessionService.getEphemeralManagedSessionById({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            ephemeralManagedSessionId: backing.ephemeralManagedSession.id
          })
      });
    }

    return await this.getMagicMcpServerBackingById(d);
  }

  async resolveMagicMcpServerBackingIdsByIntegrationResource(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationId?: string | null;
    integrationInstanceId?: string | null;
  }) {
    if (!d.integrationId && !d.integrationInstanceId) return [];

    let rows = await db.magicMcpServerBacking.findMany({
      where: {
        ownerType: 'integration',
        integrationInstance: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          id: d.integrationInstanceId ?? undefined,
          integration: d.integrationId ? { id: d.integrationId } : undefined
        }
      },
      select: {
        id: true
      }
    });

    return [...new Set(rows.map(row => row.id))].sort();
  }

  async resolveMagicMcpIntegrationResourceLinks(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationId?: string | null;
    integrationInstanceId?: string | null;
    backingCursor?: string | null;
    integrationInstanceCursor?: string | null;
    limit?: number | null;
    includeBackings?: boolean | null;
    includeIntegrationInstances?: boolean | null;
  }) {
    let limit = Math.min(Math.max(d.limit ?? 100, 1), 500);
    let includeBackings = d.includeBackings !== false;
    let includeIntegrationInstances = d.includeIntegrationInstances !== false;

    if (!d.integrationId && !d.integrationInstanceId) {
      return {
        magicMcpServerBackingIds: [],
        integrationInstanceIds: [],
        nextBackingCursor: null,
        nextIntegrationInstanceCursor: null
      };
    }

    let integrationInstances = includeIntegrationInstances
      ? await db.integrationInstance.findMany({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            id: d.integrationInstanceId
              ? d.integrationInstanceId
              : d.integrationInstanceCursor
                ? { gt: d.integrationInstanceCursor }
                : undefined,
            integration: d.integrationId ? { id: d.integrationId } : undefined
          },
          orderBy: { id: 'asc' },
          take: limit,
          select: {
            id: true
          }
        })
      : [];

    let rows = includeBackings
      ? await db.magicMcpServerBacking.findMany({
          where: {
            integrationInstance: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid
            },
            id: d.backingCursor ? { gt: d.backingCursor } : undefined,
            OR: [
              ...(d.integrationInstanceId
                ? [
                    {
                      integrationInstance: {
                        id: d.integrationInstanceId
                      }
                    }
                  ]
                : []),
              ...(d.integrationId
                ? [
                    {
                      integrationInstance: {
                        integration: {
                          id: d.integrationId
                        }
                      }
                    },
                    {
                      integration: {
                        id: d.integrationId
                      }
                    },
                    {
                      ownerIntegration: {
                        id: d.integrationId
                      }
                    },
                    {
                      providerTemplateBacking: {
                        integration: {
                          id: d.integrationId
                        }
                      }
                    }
                  ]
                : [])
            ]
          },
          orderBy: { id: 'asc' },
          take: limit,
          select: {
            id: true,
            integrationInstance: {
              select: {
                id: true
              }
            }
          }
        })
      : [];

    let lastBacking = rows[rows.length - 1];
    let lastIntegrationInstance = integrationInstances[integrationInstances.length - 1];

    return {
      magicMcpServerBackingIds: [...new Set(rows.map(row => row.id))].sort(),
      integrationInstanceIds: [
        ...new Set([
          ...integrationInstances.map(integrationInstance => integrationInstance.id),
          ...rows.map(row => row.integrationInstance.id)
        ])
      ].sort(),
      nextBackingCursor: rows.length === limit && lastBacking ? lastBacking.id : null,
      nextIntegrationInstanceCursor:
        integrationInstances.length === limit && lastIntegrationInstance
          ? lastIntegrationInstance.id
          : null
    };
  }

  async resolveMagicMcpServerBackingIdsForIntegrationInstanceUsage(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationInstanceId: string;
    ownerTypes?: MagicMcpOwnerType[];
  }) {
    let integrationInstance = await db.integrationInstance.findFirst({
      where: {
        id: d.integrationInstanceId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      select: {
        oid: true
      }
    });
    if (!integrationInstance) {
      throw new ServiceError(notFoundError('integration.instance', d.integrationInstanceId));
    }

    let ownerTypes = d.ownerTypes?.length
      ? d.ownerTypes
      : (['server_owned', 'provider_template', 'integration'] satisfies MagicMcpOwnerType[]);

    let rows = await db.magicMcpServerBacking.findMany({
      where: {
        ownerType: { in: ownerTypes },
        integrationInstance: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        integrationInstanceOid: integrationInstance.oid
      },
      select: {
        id: true
      }
    });

    return [...new Set(rows.map(row => row.id))].sort();
  }
}

export let magicMcpServerBackingService = Service.create(
  'magicMcpServerBacking',
  () => new magicMcpServerBackingServiceImpl()
).build();
