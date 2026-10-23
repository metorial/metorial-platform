import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  Prisma,
  snowflake,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  ephemeralManagedSessionService,
  sessionTemplateService
} from '@metorial-subspace/module-session';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  findOwnerActorOid
} from '@metorial-subspace/module-tenant';
import { syncMagicMcpEndpointBacking } from '../../queues/lifecycle/magicMcpBackingSync';
import { integrationInstanceGroupService } from '../integrationInstanceGroup';
import {
  type MagicMcpBackingInputBase,
  magicMcpEndpointBackingInclude,
  resolveActorOid,
  withMagicMcpBackingLock
} from './shared';

type UpsertMagicMcpEndpointBackingParams = {
  input: MagicMcpBackingInputBase & {
    servers: {
      id: string;
      magicMcpServerBackingId: string;
      toolFilters?: PrismaJson.ToolFilter | null;
    }[];
    isReconciliation?: boolean;
  };
};

export type MagicMcpEndpointBackingStatus = 'healthy' | 'stale' | 'missing';

type GetMagicMcpEndpointBackingByIdParams = {
  magicMcpEndpointBackingId: string;
};

type ArchiveMagicMcpEndpointBackingParams = {
  magicMcpEndpointBackingId: string;
};

let hasToolFiltersInput = (
  input: UpsertMagicMcpEndpointBackingParams['input']['servers'][number] | undefined
) => !!input && Object.prototype.hasOwnProperty.call(input, 'toolFilters');

class magicMcpEndpointBackingServiceImpl {
  async upsertMagicMcpEndpointBacking(d: MetorialFacing<UpsertMagicMcpEndpointBackingParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.upsertMagicMcpEndpointBackingInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async upsertMagicMcpEndpointBackingInternal(
    d: { tenant: Tenant; environment: Environment } & UpsertMagicMcpEndpointBackingParams
  ) {
    let solution = await getMetorialSolution();

    let actorOid = await resolveActorOid({
      tenant: d.tenant,
      solution,
      environment: d.environment,
      identityActorId: d.input.identityActorId,
      identityId: d.input.identityId
    });
    let ownerActorOid = await findOwnerActorOid({
      tenant: d.tenant,
      environment: d.environment,
      ownerActorId: d.input.ownerActorId
    });

    let syncTarget = await withMagicMcpBackingLock(
      [`endpoint:${d.input.id}`],
      async () =>
        await withTransaction(async db => {
          let serverBackings = await db.magicMcpServerBacking.findMany({
            where: {
              id: { in: d.input.servers.map(server => server.magicMcpServerBackingId) },
              integrationInstance: {
                tenantOid: d.tenant.oid,
                solutionOid: solution.oid,
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

          let owner = {
            ownerActorOid,
            isOwnerLocked:
              !!d.input.isOwnerLocked ||
              serverBackings.some(serverBacking => serverBacking.isOwnerLocked)
          };

          let group =
            await integrationInstanceGroupService.upsertMagicMcpIntegrationInstanceGroupInternal(
              {
                tenant: d.tenant,
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
                  ),
                  owner
                }
              }
            );

          let sessionTemplate =
            await sessionTemplateService.upsertInternalLinkedSessionTemplateInternal({
              tenant: d.tenant,
              environment: d.environment,
              sessionTemplate: existing?.sessionTemplate,
              input: {
                name: d.input.name?.trim() || d.input.id,
                description: d.input.description,
                metadata: d.input.metadata,
                privateMetadata: d.input.privateMetadata,
                integrationInstanceGroup: group,
                owner
              }
            });

          let ephemeralManagedSession =
            await ephemeralManagedSessionService.upsertPlaceholderEphemeralManagedSessionInternal(
              {
                tenant: d.tenant,
                environment: d.environment,
                ephemeralManagedSession: existing?.ephemeralManagedSession,
                sessionTemplate,
                input: {
                  maxSessionDurationInMinutes: d.input.maxSessionDurationInMinutes,
                  actorOid,
                  owner,
                  isReconciling: false
                }
              }
            );

          let backing = await db.magicMcpEndpointBacking.upsert({
            where: { id: d.input.id },
            create: {
              oid: snowflake.nextId(),
              id: d.input.id,
              integrationGroupOid: group.oid,
              sessionTemplateOid: sessionTemplate.oid,
              ephemeralManagedSessionOid: ephemeralManagedSession.oid,
              actorOid,
              ownerActorOid: owner.ownerActorOid,
              isOwnerLocked: owner.isOwnerLocked
            },
            update: {
              integrationGroupOid: group.oid,
              sessionTemplateOid: sessionTemplate.oid,
              ephemeralManagedSessionOid: ephemeralManagedSession.oid,
              actorOid,
              ownerActorOid: owner.ownerActorOid,
              isOwnerLocked: owner.isOwnerLocked
            }
          });

          let persistedBacking = backing;
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
            let toolFiltersUpdate = hasToolFiltersInput(serverInput)
              ? { toolFilters: serverInput.toolFilters ?? Prisma.JsonNull }
              : {};
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
                ...toolFiltersUpdate
              }
            });
            servers.push({ ...server, magicMcpServerBacking: serverBacking });
          }

          return { backing, group, sessionTemplate, ephemeralManagedSession, servers };
        })
    );

    await syncMagicMcpEndpointBacking({
      tenant: d.tenant,
      solution,
      environment: d.environment,
      magicMcpEndpointBackingId: d.input.id
    });

    return {
      ...syncTarget.backing,
      integrationGroup: syncTarget.group,
      sessionTemplate: syncTarget.sessionTemplate,
      ephemeralManagedSession: syncTarget.ephemeralManagedSession,
      actor: null,
      servers: syncTarget.servers
    };
  }

  async getMagicMcpEndpointBackingById(
    d: MetorialFacing<GetMagicMcpEndpointBackingByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getMagicMcpEndpointBackingByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getMagicMcpEndpointBackingByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetMagicMcpEndpointBackingByIdParams
  ) {
    let solution = await getMetorialSolution();

    let backing = await db.magicMcpEndpointBacking.findFirst({
      where: {
        id: d.magicMcpEndpointBackingId,
        integrationGroup: {
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
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

  async setMagicMcpEndpointBackingOwnerLock(
    d: MetorialFacing<GetMagicMcpEndpointBackingByIdParams & { isOwnerLocked: boolean }>
  ) {
    let backing = await this.getMagicMcpEndpointBackingById(d);

    await withTransaction(async db => {
      await db.magicMcpEndpointBacking.update({
        where: { oid: backing.oid },
        data: { isOwnerLocked: d.isOwnerLocked }
      });
      await db.integrationInstanceGroup.update({
        where: { oid: backing.integrationGroupOid },
        data: { isOwnerLocked: d.isOwnerLocked }
      });
      await db.sessionTemplate.update({
        where: { oid: backing.sessionTemplateOid },
        data: { isOwnerLocked: d.isOwnerLocked }
      });
      await db.ephemeralManagedSession.update({
        where: { oid: backing.ephemeralManagedSessionOid },
        data: { isOwnerLocked: d.isOwnerLocked }
      });
    });
  }

  async getMagicMcpEndpointBackingStatus(
    d: MetorialFacing<{ magicMcpEndpointBackingId: string }>
  ): Promise<MagicMcpEndpointBackingStatus> {
    let scope = await resolveMetorialFacing(d);
    let solution = await getMetorialSolution();

    let backing = await db.magicMcpEndpointBacking.findFirst({
      where: {
        id: d.magicMcpEndpointBackingId,
        integrationGroup: {
          tenantOid: scope.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: scope.environment.oid
        }
      },
      select: {
        sessionTemplate: { select: { status: true } },
        ephemeralManagedSession: { select: { status: true } }
      }
    });
    if (!backing) return 'missing';

    return backing.sessionTemplate.status !== 'active' ||
      backing.ephemeralManagedSession.status !== 'active'
      ? 'stale'
      : 'healthy';
  }

  async archiveMagicMcpEndpointBacking(
    d: MetorialFacing<ArchiveMagicMcpEndpointBackingParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.archiveMagicMcpEndpointBackingInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveMagicMcpEndpointBackingInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveMagicMcpEndpointBackingParams
  ) {
    let backing = await this.getMagicMcpEndpointBackingByIdInternal(d);
    checkTenant(d, backing.integrationGroup);

    await integrationInstanceGroupService.archiveIntegrationInstanceGroupInternal({
      tenant: d.tenant,
      environment: d.environment,
      integrationInstanceGroup: backing.integrationGroup,
      _canModifyMagicMcpBacking: true
    });
    await sessionTemplateService.archiveSessionTemplateInternal({
      tenant: d.tenant,
      environment: d.environment,
      sessionTemplate: backing.sessionTemplate,
      _allowLinked: true
    });
    await ephemeralManagedSessionService.archiveEphemeralManagedSessionInternal({
      tenant: d.tenant,
      environment: d.environment,
      ephemeralManagedSession:
        await ephemeralManagedSessionService.getEphemeralManagedSessionByIdInternal({
          tenant: d.tenant,
          environment: d.environment,
          ephemeralManagedSessionId: backing.ephemeralManagedSession.id
        })
    });

    return await this.getMagicMcpEndpointBackingByIdInternal(d);
  }
}

export let magicMcpEndpointBackingService = Service.create(
  'magicMcpEndpointBacking',
  () => new magicMcpEndpointBackingServiceImpl()
).build();
