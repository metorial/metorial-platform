import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Agent,
  type AgentClient,
  type AgentInstanceType,
  type Environment,
  getId,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter
} from '@metorial-subspace/list-utils';
import { checkTenant } from '@metorial-subspace/module-tenant';

let include = {
  agent: true,
  agentClient: true
};

class agentInstanceServiceImpl {
  async listAgentInstances(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    agent: Agent;

    types?: AgentInstanceType[];
    ids?: string[];
    agentClientIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    checkTenant(d, d.agent);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.agentInstance.findMany({
            ...opts,
            where: {
              agentOid: d.agent.oid,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.types ? { type: { in: d.types } } : undefined!,
                d.agentClientIds ? { agentClient: { id: { in: d.agentClientIds } } } : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getAgentInstanceById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    agent: Agent;
    agentInstanceId: string;
  }) {
    checkTenant(d, d.agent);

    let agentInstance = await db.agentInstance.findFirst({
      where: {
        id: d.agentInstanceId,
        agentOid: d.agent.oid
      },
      include
    });
    if (!agentInstance) {
      throw new ServiceError(notFoundError('agent.instance', d.agentInstanceId));
    }

    return agentInstance;
  }

  async createAgentInstance(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    agent: Agent;
    agentClient?: AgentClient | null;

    input: {
      name: string;
      version?: string;
      description?: string;
      hash: string;
      type: AgentInstanceType;
    };
  }) {
    checkTenant(d, d.agent);
    checkTenant(d, d.agentClient);
    checkDeletedRelation(d.agent);

    return await withTransaction(async db => {
      return await db.agentInstance.create({
        data: {
          ...getId('agentInstance'),

          name: d.input.name.trim(),
          version: d.input.version?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          hash: d.input.hash,
          type: d.input.type,

          agentOid: d.agent.oid,
          agentClientOid: d.agentClient?.oid
        },
        include
      });
    });
  }
}

export let agentInstanceService = Service.create(
  'agentInstance',
  () => new agentInstanceServiceImpl()
).build();
