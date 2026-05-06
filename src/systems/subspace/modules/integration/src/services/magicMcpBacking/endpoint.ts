import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  ephemeralManagedSessionService,
  sessionTemplateProviderService,
  sessionTemplateService
} from '@metorial-subspace/module-session';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { integrationInstanceGroupService } from '../integrationInstanceGroup';
import { integrationInstanceGroupProviderService } from '../integrationInstanceGroupProvider';
import {
  type MagicMcpBackingInputBase,
  magicMcpEndpointBackingInclude,
  resolveActorOid,
  withMagicMcpBackingLock
} from './shared';

type UpsertMagicMcpEndpointBackingInput = {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  input: MagicMcpBackingInputBase & {
    servers: {
      id: string;
      magicMcpServerBackingId: string;
      toolFilters?: PrismaJson.ToolFilter | null;
    }[];
    isReconciliation?: boolean;
  };
};

class magicMcpEndpointBackingServiceImpl {
  async upsertMagicMcpEndpointBacking(d: UpsertMagicMcpEndpointBackingInput) {
    let actorOid = await resolveActorOid({ ...d, identityActorId: d.input.identityActorId });

    await withMagicMcpBackingLock(
      [
        `endpoint:${d.input.id}`,
        ...d.input.servers.map(server => `server:${server.magicMcpServerBackingId}`)
      ],
      async () =>
        await withTransaction(async db => {
          let serverBackings = await db.magicMcpServerBacking.findMany({
            where: {
              id: { in: d.input.servers.map(server => server.magicMcpServerBackingId) },
              integrationInstance: {
                tenantOid: d.tenant.oid,
                solutionOid: d.solution.oid,
                environmentOid: d.environment.oid
              }
            },
            include: {
              integrationInstance: {
                include: {
                  integrationInstanceProviders: {
                    where: { status: 'active', isParentDeleted: false },
                    include: { currentVersion: true }
                  }
                }
              }
            }
          });
          let serverBackingsById = new Map(
            serverBackings.map(backing => [backing.id, backing])
          );

          for (let input of d.input.servers) {
            if (!serverBackingsById.has(input.magicMcpServerBackingId)) {
              throw new ServiceError(
                notFoundError('magic_mcp.server_backing', input.magicMcpServerBackingId)
              );
            }
          }

          let existing = await db.magicMcpEndpointBacking.findUnique({
            where: { id: d.input.id },
            include: magicMcpEndpointBackingInclude
          });

          let group =
            await integrationInstanceGroupService.upsertMagicMcpIntegrationInstanceGroup({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              integrationInstanceGroup: existing?.integrationGroup,
              input: {
                name: d.input.name?.trim() || d.input.id,
                description: d.input.description,
                metadata: d.input.metadata,
                privateMetadata: d.input.privateMetadata
              }
            });

          let sessionTemplate =
            await sessionTemplateService.upsertInternalLinkedSessionTemplate({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              sessionTemplate: existing?.sessionTemplate,
              input: {
                name: d.input.name?.trim() || d.input.id,
                description: d.input.description,
                metadata: d.input.metadata,
                privateMetadata: d.input.privateMetadata,
                integrationInstanceGroup: group
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
                actorOid
              }
            });

          await db.magicMcpEndpointBacking.upsert({
            where: { id: d.input.id },
            create: {
              id: d.input.id,
              integrationGroupOid: group.oid,
              sessionTemplateOid: sessionTemplate.oid,
              ephemeralManagedSessionOid: ephemeralManagedSession.oid,
              actorOid
            },
            update: {
              integrationGroupOid: group.oid,
              sessionTemplateOid: sessionTemplate.oid,
              ephemeralManagedSessionOid: ephemeralManagedSession.oid,
              actorOid
            }
          });

          let backing = await db.magicMcpEndpointBacking.findUniqueOrThrow({
            where: { id: d.input.id }
          });
          let requestedJoinIds = new Set(d.input.servers.map(server => server.id));
          await db.magicMcpEndpointServerBacking.deleteMany({
            where: {
              magicMcpEndpointBackingOid: backing.oid,
              id: { notIn: Array.from(requestedJoinIds) }
            }
          });

          for (let serverInput of d.input.servers) {
            let serverBacking = serverBackingsById.get(serverInput.magicMcpServerBackingId)!;
            await db.magicMcpEndpointServerBacking.upsert({
              where: { id: serverInput.id },
              create: {
                id: serverInput.id,
                magicMcpEndpointBackingOid: backing.oid,
                magicMcpServerBackingOid: serverBacking.oid
              },
              update: {
                magicMcpEndpointBackingOid: backing.oid,
                magicMcpServerBackingOid: serverBacking.oid
              }
            });
          }

          let groupProviderInput = d.input.servers.flatMap(serverInput => {
            let serverBacking = serverBackingsById.get(serverInput.magicMcpServerBackingId)!;
            return serverBacking.integrationInstance.integrationInstanceProviders
              .filter(provider => provider.currentVersion?.configOid)
              .map(provider => ({
                integrationInstanceProviderId: provider.id,
                toolFilters: serverInput.toolFilters
              }));
          });

          await integrationInstanceGroupProviderService.syncMagicMcpIntegrationInstanceGroupProviders(
            {
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              integrationInstanceGroup: group,
              isReconciliation: d.input.isReconciliation,
              input: groupProviderInput
            }
          );

          await sessionTemplateProviderService.syncForIntegrationInstanceGroup({
            sessionTemplate,
            integrationInstanceGroup: group
          });
          await sessionTemplateProviderService.syncHash({
            sessionTemplateId: sessionTemplate.id
          });
        })
    );

    return await db.magicMcpEndpointBacking.findUniqueOrThrow({
      where: { id: d.input.id },
      include: magicMcpEndpointBackingInclude
    });
  }

  async getMagicMcpEndpointBackingById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpEndpointBackingId: string;
  }) {
    let backing = await db.magicMcpEndpointBacking.findFirst({
      where: {
        id: d.magicMcpEndpointBackingId,
        integrationGroup: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: magicMcpEndpointBackingInclude
    });
    if (!backing) {
      throw new ServiceError(
        notFoundError('magic_mcp.endpoint_backing', d.magicMcpEndpointBackingId)
      );
    }

    return backing;
  }

  async archiveMagicMcpEndpointBacking(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    magicMcpEndpointBackingId: string;
  }) {
    let backing = await this.getMagicMcpEndpointBackingById(d);
    checkTenant(d, backing.integrationGroup);

    await integrationInstanceGroupService.archiveIntegrationInstanceGroup({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      integrationInstanceGroup: backing.integrationGroup,
      _canModifyMagicMcpBacking: true
    });
    await sessionTemplateService.archiveSessionTemplate({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      sessionTemplate: backing.sessionTemplate,
      _allowLinked: true
    });
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

    return await this.getMagicMcpEndpointBackingById(d);
  }
}

export let magicMcpEndpointBackingService = Service.create(
  'magicMcpEndpointBacking',
  () => new magicMcpEndpointBackingServiceImpl()
).build();
