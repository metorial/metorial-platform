import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type Agent,
  AgentStatus,
  db,
  type Environment,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { identityActorService } from '@metorial-subspace/module-identity';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';

let include = { actor: true };

class agentServiceImpl {
  async listAgents(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: AgentStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    agentIds?: string[];
  }) {
    let agents = await resolveProviders(d, d.agentIds);

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
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,

                agents ? { agent: agents.oidIn } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getAgentById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    agentId: string;
    allowDeleted?: boolean;
  }) {
    let agent = await db.agent.findFirst({
      where: {
        id: d.agentId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!agent) throw new ServiceError(notFoundError('agent', d.agentId));

    return agent;
  }

  async createAgent(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    input: {
      name: string;
      slug?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return withTransaction(async db => {
      let agentActor = await identityActorService.createIdentityActor({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,

        input: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          type: 'agent',
          _agentSlug: d.input.slug
        }
      });

      return await db.agent.findFirstOrThrow({
        where: { actorOid: agentActor.oid },
        include
      });
    });
  }

  async updateAgent(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    agent: Agent;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.agent);
    checkDeletedEdit(d.agent, 'update');

    return withTransaction(async db => {
      let actor = await db.identityActor.findFirstOrThrow({
        where: { oid: d.agent.actorOid }
      });

      let agentActor = await identityActorService.updateIdentityActor({
        tenant: d.tenant,
        solution: d.solution,
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
    });
  }
}

export let agentService = Service.create('agent', () => new agentServiceImpl()).build();
