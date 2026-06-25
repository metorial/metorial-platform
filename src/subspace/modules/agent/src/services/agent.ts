import { Hash } from '@lowerdeck/hash';
import { generatePlainId } from '@lowerdeck/id';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  type Agent,
  AgentStatus,
  AgentType,
  db,
  type Environment,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIdentityActors
} from '@metorial-subspace/list-utils';
import { identityActorService } from '@metorial-subspace/module-identity';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';

let include = { actor: true };
let isUniqueConstraintError = (error: any) => error?.code === 'P2002';
let getAgentUpsertSlug = (name: string) =>
  `${slugify(name)}-${generatePlainId(7).toLowerCase()}`;

class agentServiceImpl {
  async listAgents(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: AgentStatus[];
    allowDeleted?: boolean;

    types?: AgentType[];
    ids?: string[];
    actorIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let actors = await resolveIdentityActors(d, d.actorIds);

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
                d.types ? { type: { in: d.types } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                actors ? { actorOid: actors.in } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
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

    let actor = await identityActorService.getIdentityActorById({
      identityActorId: (
        await db.identityActor.findFirstOrThrow({
          where: { oid: d.agent.actorOid },
          select: { id: true }
        })
      ).id,
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      allowDeleted: true
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
  }

  async upsertAgent(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name: string;
      slug?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
      type?: AgentType;
    };
  }) {
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
        let agentActor = await identityActorService.createIdentityActor({
          tenant: d.tenant,
          solution: d.solution,
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

  async archiveAgent(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    agent: Agent;
  }) {
    checkTenant(d, d.agent);

    let actor = await identityActorService.getIdentityActorById({
      identityActorId: (
        await db.identityActor.findFirstOrThrow({
          where: { oid: d.agent.actorOid },
          select: { id: true }
        })
      ).id,
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      allowDeleted: true
    });

    let archivedActor = await identityActorService.archiveIdentityActor({
      tenant: d.tenant,
      solution: d.solution,
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
