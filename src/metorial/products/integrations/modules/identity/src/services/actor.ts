import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generateCode } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import {
  addAfterTransactionHook,
  type AgentType,
  db,
  type Environment,
  getId,
  type IdentityActor,
  type IdentityActorStatus,
  IdentityActorType,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { Fabric } from '@metorial/fabric';
import {
  assertNoActiveIntegrationActorLink,
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveAgents
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  checkTenant,
  getMetorialSolution,
  metorialDb,
  type MetorialFacing,
  toProviderEventBase,
  resolveConsumerActorIds,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import type {
  Consumer,
  ConsumerProfile,
  ConsumerSurface,
  InstanceConsumer,
  OrganizationMember
} from '@metorial/db';
import {
  identityActorCreatedQueue,
  identityActorDeletedQueue,
  identityActorUpdatedQueue
} from '../queues/lifecycle/actor';
import {
  agentCreatedQueue,
  agentDeletedQueue,
  agentUpdatedQueue
} from '../queues/lifecycle/agent';
import { identityActorInclude } from '../lib/identityActorInclude';

let include = identityActorInclude;

let getAgentSlug = createSlugGenerator(
  async (slug, d: { environment: Environment }) =>
    !(await db.agent.findUnique({
      where: {
        environmentOid_slug: {
          slug,
          environmentOid: d.environment.oid
        }
      }
    }))
);

export type IdentityActorConsumer = InstanceConsumer & {
  consumer: Consumer & {
    organizationMember: OrganizationMember | null;
    profiles: (ConsumerProfile & {
      surface: ConsumerSurface;
    })[];
  };
};

let enrichIdentityActors = async <T extends { id: string }>(actors: T[]) => {
  if (!actors.length) return actors as Array<T & { consumer?: IdentityActorConsumer }>;

  let consumerActors = await metorialDb.consumerActor.findMany({
    where: {
      id: { in: actors.map(a => a.id) }
    },
    include: {
      instanceConsumer: {
        include: {
          consumer: {
            include: {
              organizationMember: true,
              profiles: {
                include: {
                  surface: true
                }
              }
            }
          }
        }
      }
    }
  });

  let consumerActorMap = new Map(consumerActors.map(a => [a.id, a]));

  return actors.map(a => {
    let consumerActor = consumerActorMap.get(a.id);
    if (!consumerActor) return a as T & { consumer?: IdentityActorConsumer };

    return {
      ...a,
      consumer: consumerActor.instanceConsumer
    };
  });
};

export type ListIdentityActorsParams = {
  tenant: Tenant;
  environment: Environment;

  search?: string;

  status?: IdentityActorStatus[];
  allowDeleted?: boolean;

  ids?: string[];
  consumerIds?: string[];
  agentIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetIdentityActorByIdParams = {
  tenant: Tenant;
  environment: Environment;
  identityActorId: string;
  allowDeleted?: boolean;
};

export type IdentityActorConsumerOwner = {
  consumerId: string;
  instanceConsumerId: string;
  consumerProfileId: string;
};

export type CreateIdentityActorParams = {
  tenant: Tenant;
  environment: Environment;

  consumerOwner?: IdentityActorConsumerOwner;

  input: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    type: IdentityActorType;

    _agentSlug?: string;
    _agentHash?: string;
    _agentType?: AgentType;
  };
};

export type UpdateIdentityActorParams = {
  tenant: Tenant;
  environment: Environment;
  identityActor: IdentityActor;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
  };
};

export type ArchiveIdentityActorParams = {
  tenant: Tenant;
  environment: Environment;
  identityActor: IdentityActor;
};

let resolveConsumerOwnerOids = async (owner: IdentityActorConsumerOwner) => {
  let [consumer, instanceConsumer, consumerProfile] = await Promise.all([
    db.consumer.findUnique({
      where: { id: owner.consumerId },
      select: { oid: true }
    }),
    db.instanceConsumer.findUnique({
      where: { id: owner.instanceConsumerId },
      select: { oid: true }
    }),
    db.consumerProfile.findUnique({
      where: { id: owner.consumerProfileId },
      select: { oid: true }
    })
  ]);

  if (!consumer) throw new ServiceError(notFoundError('consumer', owner.consumerId));
  if (!instanceConsumer) {
    throw new ServiceError(notFoundError('consumer', owner.instanceConsumerId));
  }
  if (!consumerProfile) {
    throw new ServiceError(notFoundError('consumer.profile', owner.consumerProfileId));
  }

  return {
    consumerOid: consumer.oid,
    instanceConsumerOid: instanceConsumer.oid,
    consumerProfileOid: consumerProfile.oid
  };
};

class identityActorServiceImpl {
  async listIdentityActors(d: MetorialFacing<ListIdentityActorsParams>) {
    let { instance, organizationActor, consumerIds, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });

    let ids = rest.ids;
    if (consumerIds) {
      let consumerActorIds = await resolveConsumerActorIds(consumerIds);
      ids = [...(ids ?? []), ...consumerActorIds];
      if (!ids.length) {
        return Paginator.create(({ prisma }) => prisma(async () => []));
      }
    }

    let paginator = await this.listIdentityActorsInternal({
      ...rest,
      ids,
      tenant,
      environment
    });

    return paginator.mapAll(items => enrichIdentityActors(items));
  }

  async listIdentityActorsInternal(d: Omit<ListIdentityActorsParams, 'consumerIds'>) {
    let solution = await getMetorialSolution();
    let agents = await resolveAgents({ ...d, solution }, d.agentIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.identityActor.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identityActor.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,

                agents ? { agent: agents.oidIn } : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getIdentityActorById(d: MetorialFacing<GetIdentityActorByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    let identityActor = await this.getIdentityActorByIdInternal({
      ...rest,
      tenant,
      environment
    });
    let [enriched] = await enrichIdentityActors([identityActor]);
    return enriched!;
  }

  async getIdentityActorByIdInternal(d: GetIdentityActorByIdParams) {
    let solution = await getMetorialSolution();
    let identityActor = await db.identityActor.findFirst({
      where: {
        id: d.identityActorId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!identityActor)
      throw new ServiceError(notFoundError('identity.actor', d.identityActorId));

    return identityActor;
  }

  async createIdentityActor(d: MetorialFacing<CreateIdentityActorParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('identity.actor.created:before', eventBase);

    let identityActor = await this.createIdentityActorInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('identity.actor.created:after', {
      ...eventBase,
      identityActor
    });

    return identityActor;
  }

  async createIdentityActorInternal(d: CreateIdentityActorParams) {
    let solution = await getMetorialSolution();

    if ((d.input.type === 'consumer') !== !!d.consumerOwner) {
      throw new ServiceError(
        badRequestError({
          message: 'Consumer identity actors must be created with a consumer owner'
        })
      );
    }

    let consumerOwner = d.consumerOwner
      ? await resolveConsumerOwnerOids(d.consumerOwner)
      : undefined;

    return withTransaction(async db => {
      let identityActor = await db.identityActor.create({
        data: {
          ...getId('identityActor'),

          status: 'active',
          type: d.input.type,

          name: d.input.name.trim(),
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,

          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid,
          instanceOid: d.environment.instanceOid,

          ...consumerOwner
        }
      });

      if (identityActor.type === 'agent') {
        let agent = await db.agent.create({
          data: {
            ...getId('agent'),

            status: 'active',
            actorOid: identityActor.oid,

            name: d.input.name.trim(),
            description: d.input.description?.trim() || undefined,
            metadata: d.input.metadata,
            privateMetadata: d.input.privateMetadata,
            hash: d.input._agentHash,
            type: d.input._agentType,

            slug: await getAgentSlug(
              {
                input: d.input._agentSlug
                  ? d.input._agentSlug.trim()
                  : `${d.input.name.trim()}-${generateCode(5)}`
              },
              d
            ),

            tenantOid: d.tenant.oid,
            projectOid: d.tenant.projectOid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            instanceOid: d.environment.instanceOid
          }
        });
        await addAfterTransactionHook(async () =>
          agentCreatedQueue.add({ agentId: agent.id })
        );
      }

      await addAfterTransactionHook(async () =>
        identityActorCreatedQueue.add({ identityActorId: identityActor.id })
      );

      return db.identityActor.findUniqueOrThrow({
        where: { id: identityActor.id },
        include
      })!;
    });
  }

  async syncConsumerOwnershipInternal(d: {
    identityActorId: string;
    owner: IdentityActorConsumerOwner;
    defaultIdentityId: string | null;
  }) {
    let identityActor = await db.identityActor.findUnique({
      where: { id: d.identityActorId }
    });
    if (!identityActor) return null;

    if (identityActor.type === 'agent') {
      throw new ServiceError(
        badRequestError({
          message: 'Agent identity actors cannot be owned by a consumer'
        })
      );
    }

    let owner = await resolveConsumerOwnerOids(d.owner);

    let defaultIdentity = d.defaultIdentityId
      ? await db.identity.findFirst({
          where: { id: d.defaultIdentityId, actorOid: identityActor.oid, status: 'active' },
          select: { oid: true, id: true }
        })
      : null;
    defaultIdentity ??= await db.identity.findFirst({
      where: { actorOid: identityActor.oid, status: 'active' },
      orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
      select: { oid: true, id: true }
    });

    let defaultIdentityOid = defaultIdentity?.oid ?? null;
    let isInSync =
      identityActor.type === 'consumer' &&
      identityActor.consumerOid === owner.consumerOid &&
      identityActor.instanceConsumerOid === owner.instanceConsumerOid &&
      identityActor.consumerProfileOid === owner.consumerProfileOid &&
      identityActor.defaultIdentityOid === defaultIdentityOid;

    if (!isInSync) {
      identityActor = await db.identityActor.update({
        where: { oid: identityActor.oid },
        data: {
          type: 'consumer',
          ...owner,
          defaultIdentityOid
        }
      });

      await identityActorUpdatedQueue.add({ identityActorId: identityActor.id });
    }

    return {
      identityActor,
      defaultIdentityId: defaultIdentity?.id ?? null
    };
  }

  async setInstanceConsumerDefaultActorInternal(d: {
    instanceConsumerId: string;
    identityActorId: string | null;
  }) {
    let instanceConsumer = await db.instanceConsumer.findUnique({
      where: { id: d.instanceConsumerId },
      select: { oid: true }
    });
    if (!instanceConsumer) {
      if (!d.identityActorId) return;
      throw new ServiceError(notFoundError('consumer', d.instanceConsumerId));
    }

    let identityActor = d.identityActorId
      ? await db.identityActor.findUnique({
          where: { id: d.identityActorId, instanceConsumerOid: instanceConsumer.oid },
          select: { oid: true, defaultForInstanceConsumerOid: true }
        })
      : null;
    if (d.identityActorId && !identityActor) {
      throw new ServiceError(notFoundError('identity.actor', d.identityActorId));
    }

    await withTransaction(async db => {
      await db.identityActor.updateMany({
        where: {
          defaultForInstanceConsumerOid: instanceConsumer.oid,
          oid: identityActor ? { not: identityActor.oid } : undefined
        },
        data: { defaultForInstanceConsumerOid: null }
      });

      if (
        identityActor &&
        identityActor.defaultForInstanceConsumerOid !== instanceConsumer.oid
      ) {
        await db.identityActor.update({
          where: { oid: identityActor.oid },
          data: { defaultForInstanceConsumerOid: instanceConsumer.oid }
        });
      }
    });
  }

  async updateIdentityActor(
    d: MetorialFacing<UpdateIdentityActorParams> & { canEditConsumerActor?: boolean }
  ) {
    let { instance, organizationActor, canEditConsumerActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });

    if (!canEditConsumerActor) {
      let consumerActor = await metorialDb.consumerActor.findFirst({
        where: {
          id: rest.identityActor.id,
          instanceOid: instance.oid
        }
      });
      if (consumerActor) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot update identity actor linked to consumer'
          })
        );
      }
    }

    return this.updateIdentityActorInternal({ ...rest, tenant, environment });
  }

  async updateIdentityActorInternal(d: UpdateIdentityActorParams) {
    checkTenant(d, d.identityActor);
    checkDeletedEdit(d.identityActor, 'update');

    let existingIdentityActor = await db.identityActor.findUniqueOrThrow({
      where: { oid: d.identityActor.oid },
      include
    });

    if (existingIdentityActor.agent?.type === 'tool_call') {
      throw new ServiceError(
        badRequestError({
          message: 'Special tool call agents cannot be updated',
          code: 'agent_update_not_allowed'
        })
      );
    }

    return withTransaction(async db => {
      let identityActor = await db.identityActor.update({
        where: {
          oid: existingIdentityActor.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.identityActor.name,
          description: d.input.description ?? d.identityActor.description,
          metadata: d.input.metadata ?? d.identityActor.metadata
        },
        include
      });

      if (identityActor.agent) {
        let agent = await db.agent.update({
          where: { oid: identityActor.agent.oid },
          data: {
            name: identityActor.name,
            description: identityActor.description,
            metadata: identityActor.metadata
          }
        });

        await addAfterTransactionHook(async () =>
          agentUpdatedQueue.add({ agentId: agent.id })
        );
      }

      await addAfterTransactionHook(async () =>
        identityActorUpdatedQueue.add({ identityActorId: identityActor.id })
      );

      return identityActor;
    });
  }

  async archiveIdentityActor(
    d: MetorialFacing<ArchiveIdentityActorParams> & { canEditConsumerActor?: boolean }
  ) {
    let { instance, organizationActor, canEditConsumerActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });

    if (!canEditConsumerActor) {
      let consumerActor = await metorialDb.consumerActor.findFirst({
        where: {
          id: rest.identityActor.id,
          instanceOid: instance.oid
        }
      });
      if (consumerActor) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot delete identity actor linked to consumer'
          })
        );
      }
    }

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('identity.actor.deleted:before', eventBase);

    let identityActor = await this.archiveIdentityActorInternal({
      ...rest,
      tenant,
      environment
    });

    await Fabric.fire('identity.actor.deleted:after', { ...eventBase, identityActor });

    return identityActor;
  }

  async archiveIdentityActorInternal(d: ArchiveIdentityActorParams) {
    let solution = await getMetorialSolution();

    checkTenant(d, d.identityActor);
    checkDeletedEdit(d.identityActor, 'archive');

    let existingIdentityActor = await db.identityActor.findUniqueOrThrow({
      where: { oid: d.identityActor.oid },
      include
    });

    if (existingIdentityActor.agent?.type === 'mcp_client') {
      throw new ServiceError(
        badRequestError({
          message: 'MCP client agents cannot be deleted',
          code: 'agent_delete_not_allowed'
        })
      );
    }

    await assertNoActiveIntegrationActorLink({
      tenant: d.tenant,
      solution,
      environment: d.environment,
      identityActorOid: existingIdentityActor.oid,
      identityActorId: existingIdentityActor.id
    });

    return withTransaction(async db => {
      let identityActor = await db.identityActor.update({
        where: {
          oid: existingIdentityActor.oid,
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        },
        include
      });

      if (identityActor.agent) {
        let agent = await db.agent.update({
          where: { oid: identityActor.agent.oid },
          data: {
            status: 'archived',
            archivedAt: identityActor.archivedAt
          }
        });

        await addAfterTransactionHook(async () =>
          agentDeletedQueue.add({ agentId: agent.id })
        );
      }

      await addAfterTransactionHook(async () =>
        identityActorDeletedQueue.add({ identityActorId: identityActor.id })
      );

      return identityActor;
    });
  }
}

export let identityActorService = Service.create(
  'identityActor',
  () => new identityActorServiceImpl()
).build();
