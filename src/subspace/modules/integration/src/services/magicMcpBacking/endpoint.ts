import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  Prisma,
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
import {
  enqueueMagicMcpEndpointBackingReconcile,
  reconcileMagicMcpEndpointBacking
} from '../../queues/lifecycle/magicMcpBackingReconcile';
import { integrationInstanceGroupService } from '../integrationInstanceGroup';
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
    deferReconcile?: boolean;
  };
};

class magicMcpEndpointBackingServiceImpl {
  async upsertMagicMcpEndpointBacking(d: UpsertMagicMcpEndpointBackingInput) {
    let actorOid = await resolveActorOid({
      ...d,
      identityActorId: d.input.identityActorId,
      identityId: d.input.identityId
    });

    let shouldDeferReconcile = d.input.deferReconcile !== false;
    let syncTarget = await withMagicMcpBackingLock(
      [`endpoint:${d.input.id}`],
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
                  identityActor: true,
                  identity: true
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
            include: {
              integrationGroup: true,
              sessionTemplate: true,
              ephemeralManagedSession: true
            }
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
                privateMetadata: d.input.privateMetadata,
                identityActorId: d.input.identityActorId,
                identityId: d.input.identityId,
                identitySourceIntegrationInstances: serverBackings.map(
                  backing => backing.integrationInstance
                )
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
                actorOid,
                isReconciling: shouldDeferReconcile
              }
            });

          let backing = await db.magicMcpEndpointBacking.upsert({
            where: { id: d.input.id },
            create: {
              oid: snowflake.nextId(),
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

          let persistedBacking = await db.magicMcpEndpointBacking.findUniqueOrThrow({
            where: { id: d.input.id }
          });
          let requestedJoinIds = new Set(d.input.servers.map(server => server.id));
          await db.magicMcpEndpointServerBacking.deleteMany({
            where: {
              magicMcpEndpointBackingOid: persistedBacking.oid,
              id: { notIn: Array.from(requestedJoinIds) }
            }
          });

          let servers = [];
          for (let serverInput of d.input.servers) {
            let serverBacking = serverBackingsById.get(serverInput.magicMcpServerBackingId)!;
            let server = await db.magicMcpEndpointServerBacking.upsert({
              where: { id: serverInput.id },
              create: {
                oid: snowflake.nextId(),
                id: serverInput.id,
                magicMcpEndpointBackingOid: persistedBacking.oid,
                magicMcpServerBackingOid: serverBacking.oid,
                toolFilters: serverInput.toolFilters ?? Prisma.JsonNull
              },
              update: {
                magicMcpEndpointBackingOid: persistedBacking.oid,
                magicMcpServerBackingOid: serverBacking.oid,
                toolFilters: serverInput.toolFilters ?? Prisma.JsonNull
              }
            });
            servers.push({ ...server, magicMcpServerBacking: serverBacking });
          }

          return { backing, group, sessionTemplate, ephemeralManagedSession, servers };
        })
    );

    if (shouldDeferReconcile) {
      await enqueueMagicMcpEndpointBackingReconcile({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpEndpointBackingId: d.input.id
      });
    } else {
      await reconcileMagicMcpEndpointBacking({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpEndpointBackingId: d.input.id
      });
    }

    return {
      ...syncTarget.backing,
      integrationGroup: syncTarget.group,
      sessionTemplate: syncTarget.sessionTemplate,
      ephemeralManagedSession: syncTarget.ephemeralManagedSession,
      actor: null,
      servers: syncTarget.servers
    };
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
