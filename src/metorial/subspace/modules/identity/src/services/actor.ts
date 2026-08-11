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
import {
  assertNoActiveIntegrationActorLink,
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  checkTenant,
  getMetorialSolution,
  metorialDb,
  type MetorialFacing,
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

let include = {
  agent: true
};

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

export type CreateIdentityActorParams = {
  tenant: Tenant;
  environment: Environment;

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

    let paginator = this.listIdentityActorsInternal({ ...rest, ids, tenant, environment });

    return {
      run: async (query: Parameters<typeof paginator.run>[0]) => {
        let list = await paginator.run(query);
        let items = await enrichIdentityActors(list.items);
        return { ...list, items };
      }
    };
  }

  async listIdentityActorsInternal(d: Omit<ListIdentityActorsParams, 'consumerIds'>) {
    let solution = await getMetorialSolution();
    let agents = await resolveProviders({ ...d, solution }, d.agentIds);

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
    return this.createIdentityActorInternal({ ...rest, tenant, environment });
  }

  async createIdentityActorInternal(d: CreateIdentityActorParams) {
    let solution = await getMetorialSolution();

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
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
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
            solutionOid: solution.oid,
            environmentOid: d.environment.oid
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

    return this.archiveIdentityActorInternal({ ...rest, tenant, environment });
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
