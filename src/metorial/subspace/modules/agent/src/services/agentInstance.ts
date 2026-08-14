import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type Agent,
  type AgentClient,
  type AgentClientRegistration,
  type AgentInstanceType,
  db,
  type Environment,
  getId,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';

let include = {
  agent: true,
  agentClient: true,
  agentClientRegistration: true
};

export type ListAgentInstancesParams = {
  tenant: Tenant;
  environment: Environment;

  agent: Agent;

  types?: AgentInstanceType[];
  ids?: string[];
  agentClientIds?: string[];

  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetAgentInstanceByIdParams = {
  tenant: Tenant;
  environment: Environment;
  agent: Agent;
  agentInstanceId: string;
};

export type UpsertAgentInstanceParams = {
  tenant: Tenant;
  environment: Environment;

  agent: Agent;
  agentClient?: AgentClient | null;
  agentClientRegistration?: AgentClientRegistration | null;

  input: {
    name: string;
    version?: string;
    description?: string;
    type: AgentInstanceType;
  };
};

class agentInstanceServiceImpl {
  async listAgentInstances(d: MetorialFacing<ListAgentInstancesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listAgentInstancesInternal({ ...rest, tenant, environment });
  }

  async listAgentInstancesInternal(d: ListAgentInstancesParams) {
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
                d.agentClientIds
                  ? { agentClient: { id: { in: d.agentClientIds } } }
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

  async getAgentInstanceById(d: MetorialFacing<GetAgentInstanceByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getAgentInstanceByIdInternal({ ...rest, tenant, environment });
  }

  async getAgentInstanceByIdInternal(d: GetAgentInstanceByIdParams) {
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

  async upsertAgentInstance(d: MetorialFacing<UpsertAgentInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.upsertAgentInstanceInternal({ ...rest, tenant, environment });
  }

  async upsertAgentInstanceInternal(d: UpsertAgentInstanceParams) {
    checkTenant(d, d.agent);
    checkTenant(d, d.agentClient);
    checkDeletedRelation(d.agent);

    if (
      d.agentClient &&
      d.agentClientRegistration &&
      d.agentClientRegistration.agentClientOid !== d.agentClient.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Agent client registration does not belong to the provided agent client'
        })
      );
    }

    if (d.agent.type === 'tool_call' && d.input.type !== 'tool_call') {
      throw new ServiceError(
        badRequestError({
          message: 'Agent cannot be used for this connection type'
        })
      );
    }

    let hash = await Hash.sha256(
      JSON.stringify([
        d.input.name,
        d.input.version,
        d.agent.id,
        d.agentClient?.id ?? null,
        d.agentClientRegistration?.id ?? null,
        d.input.type
      ])
    );

    return await withTransaction(async db => {
      return await db.agentInstance.upsert({
        where: {
          agentOid_hash: {
            agentOid: d.agent.oid,
            hash
          }
        },
        create: {
          ...getId('agentInstance'),

          name: d.input.name.trim(),
          version: d.input.version?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          hash,
          type: d.input.type,
          lastConnectedAt: new Date(),

          agentOid: d.agent.oid,
          agentClientOid: d.agentClient?.oid,
          agentClientRegistrationOid: d.agentClientRegistration?.oid
        },
        update: {
          name: d.input.name.trim(),
          version: d.input.version?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          type: d.input.type,
          lastConnectedAt: new Date(),
          agentClientOid: d.agentClient?.oid,
          agentClientRegistrationOid: d.agentClientRegistration?.oid
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
