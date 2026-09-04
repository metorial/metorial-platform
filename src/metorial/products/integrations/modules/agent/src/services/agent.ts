import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  type Agent,
  AgentStatus,
  AgentType,
  db,
  type Environment,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { Fabric, type AuditSubspaceAgent } from '@metorial/fabric';
import {
  type DateFilter,
  getConnectionRetentionFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIdentityActors
} from '@metorial-subspace/list-utils';
import { identityActorService } from '@metorial-subspace/module-identity';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  toProviderEventBase,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

let include = { actor: true };
let isUniqueConstraintError = (error: any) => error?.code === 'P2002';
let getAgentUpsertSlug = (name: string) =>
  `${slugify(name)}-${generatePlainId(7).toLowerCase()}`;

export type ListAgentsParams = {
  tenant: Tenant;
  environment: Environment;

  search?: string;

  status?: AgentStatus[];
  allowDeleted?: boolean;

  types?: AgentType[];
  ids?: string[];
  actorIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetAgentByIdParams = {
  tenant: Tenant;
  environment: Environment;
  agentId: string;
  allowDeleted?: boolean;
};

export type CreateAgentParams = {
  tenant: Tenant;
  environment: Environment;

  input: {
    name: string;
    slug?: string;
    description?: string;
    metadata?: Record<string, any>;
  };
};

export type UpdateAgentParams = {
  tenant: Tenant;
  environment: Environment;
  agent: Agent;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
  };
};

export type UpdateAgentFacingParams = Omit<UpdateAgentParams, 'agent'> & {
  agent: UpdateAgentParams['agent'] & AuditSubspaceAgent;
};

export type UpsertAgentParams = {
  tenant: Tenant;
  environment: Environment;
  input: {
    name: string;
    slug?: string;
    description?: string;
    metadata?: Record<string, any>;
    privateMetadata?: Record<string, any>;
    type?: AgentType;
  };
};

export type ArchiveAgentParams = {
  tenant: Tenant;
  environment: Environment;
  agent: Agent;
};

class agentServiceImpl {
  async listAgents(d: MetorialFacing<ListAgentsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listAgentsInternal({ ...rest, tenant, environment });
  }

  async listAgentsInternal(d: ListAgentsParams) {
    let solution = await getMetorialSolution();
    let actors = await resolveIdentityActors({ ...d, solution }, d.actorIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.agent.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.agent.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                actors
                  ? {
                      OR: [
                        { actorOid: actors.in },
                        {
                          agentInstances: {
                            some: {
                              sessionParticipants: {
                                some: {
                                  sessionConnections: {
                                    some: {
                                      status: 'active' as const,
                                      isParentDeleted: false,
                                      ...getConnectionRetentionFilter(d.tenant),
                                      session: { identityActorOid: actors.in }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      ]
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

  async getAgentById(d: MetorialFacing<GetAgentByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getAgentByIdInternal({ ...rest, tenant, environment });
  }

  async getAgentByIdInternal(d: GetAgentByIdParams) {
    let solution = await getMetorialSolution();
    let agent = await db.agent.findFirst({
      where: {
        id: d.agentId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!agent) throw new ServiceError(notFoundError('agent', d.agentId));

    return agent;
  }

  async createAgent(d: MetorialFacing<CreateAgentParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('identity.agent.created:before', eventBase);
    await Fabric.fire('identity.actor.created:before', eventBase);

    let agent = await this.createAgentInternal({ ...rest, tenant, environment });

    await Fabric.fire('identity.agent.created:after', {
      ...eventBase,
      agent
    });
    await Fabric.fire('identity.actor.created:after', {
      ...eventBase,
      identityActor: agent.actor
    });

    return agent;
  }

  async createAgentInternal(d: CreateAgentParams) {
    return withTransaction(async db => {
      let agentActor = await identityActorService.createIdentityActorInternal({
        tenant: d.tenant,
        environment: d.environment,

        input: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          type: 'agent',
          _agentSlug: d.input.slug,
          _agentType: 'custom'
        }
      });

      return await db.agent.findFirstOrThrow({
        where: { actorOid: agentActor.oid },
        include
      });
    });
  }

  async updateAgent(d: MetorialFacing<UpdateAgentFacingParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('identity.agent.updated:before', eventBase);

    let agent = await this.updateAgentInternal({ ...rest, tenant, environment });

    await Fabric.fire('identity.agent.updated:after', {
      ...eventBase,
      agent,
      previousAgent: d.agent
    });

    return agent;
  }

  async updateAgentInternal(d: UpdateAgentParams) {
    checkTenant(d, d.agent);

    let actor = await identityActorService.getIdentityActorByIdInternal({
      identityActorId: (
        await db.identityActor.findFirstOrThrow({
          where: { oid: d.agent.actorOid },
          select: { id: true }
        })
      ).id,
      tenant: d.tenant,
      environment: d.environment,
      allowDeleted: true
    });

    let agentActor = await identityActorService.updateIdentityActorInternal({
      tenant: d.tenant,
      environment: d.environment,
      identityActor: actor,
      input: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata
      }
    });

    return await db.agent.findFirstOrThrow({
      where: { actorOid: agentActor.oid },
      include
    });
  }

  async upsertAgent(d: MetorialFacing<UpsertAgentParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.upsertAgentInternal({ ...rest, tenant, environment });
  }

  async upsertAgentInternal(d: UpsertAgentParams) {
    let name = d.input.name.trim();
    let type = d.input.type ?? 'custom';
    let hash = await Hash.sha256(JSON.stringify([name, type]));

    let getExisting = async () =>
      await db.agent.findUnique({
        where: {
          environmentOid_hash: {
            environmentOid: d.environment.oid,
            hash
          }
        },
        include
      });

    let existing = await getExisting();
    if (existing) return existing;

    try {
      return await withTransaction(async db => {
        let agentActor = await identityActorService.createIdentityActorInternal({
          tenant: d.tenant,
          environment: d.environment,

          input: {
            name,
            description: d.input.description,
            metadata: d.input.metadata,
            privateMetadata: d.input.privateMetadata,
            type: 'agent',
            _agentSlug: d.input.slug?.trim() || getAgentUpsertSlug(name),
            _agentHash: hash,
            _agentType: type
          }
        });

        return await db.agent.findFirstOrThrow({
          where: { actorOid: agentActor.oid },
          include
        });
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let existingAfterConflict = await getExisting();
      if (existingAfterConflict) return existingAfterConflict;

      throw error;
    }
  }

  async archiveAgent(d: MetorialFacing<ArchiveAgentParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('identity.agent.deleted:before', eventBase);
    await Fabric.fire('identity.actor.deleted:before', eventBase);

    let agent = await this.archiveAgentInternal({ ...rest, tenant, environment });

    await Fabric.fire('identity.agent.deleted:after', {
      ...eventBase,
      agent
    });
    await Fabric.fire('identity.actor.deleted:after', {
      ...eventBase,
      identityActor: agent.actor
    });

    return agent;
  }

  async archiveAgentInternal(d: ArchiveAgentParams) {
    checkTenant(d, d.agent);

    let actor = await identityActorService.getIdentityActorByIdInternal({
      identityActorId: (
        await db.identityActor.findFirstOrThrow({
          where: { oid: d.agent.actorOid },
          select: { id: true }
        })
      ).id,
      tenant: d.tenant,
      environment: d.environment,
      allowDeleted: true
    });

    let archivedActor = await identityActorService.archiveIdentityActorInternal({
      tenant: d.tenant,
      environment: d.environment,
      identityActor: actor
    });

    return await db.agent.findFirstOrThrow({
      where: { actorOid: archivedActor.oid },
      include
    });
  }
}

export let agentService = Service.create('agent', () => new agentServiceImpl()).build();
