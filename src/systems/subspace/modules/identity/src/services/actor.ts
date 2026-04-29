import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generateCode } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type IdentityActor,
  type IdentityActorStatus,
  IdentityActorType,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
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

class identityActorServiceImpl {
  async listIdentityActors(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: IdentityActorStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    agentIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let agents = await resolveProviders(d, d.agentIds);

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
              solutionOid: d.solution.oid,
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

  async getIdentityActorById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityActorId: string;
    allowDeleted?: boolean;
  }) {
    let identityActor = await db.identityActor.findFirst({
      where: {
        id: d.identityActorId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!identityActor)
      throw new ServiceError(notFoundError('identity.actor', d.identityActorId));

    return identityActor;
  }

  async createIdentityActor(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
      type: IdentityActorType;

      _agentSlug?: string;
    };
  }) {
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
          solutionOid: d.solution.oid,
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

            slug: await getAgentSlug(
              {
                input: d.input._agentSlug
                  ? d.input._agentSlug.trim()
                  : `${d.input.name.trim()}-${generateCode(5)}`
              },
              d
            ),

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
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

  async updateIdentityActor(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityActor: IdentityActor;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.identityActor);
    checkDeletedEdit(d.identityActor, 'update');

    return withTransaction(async db => {
      let identityActor = await db.identityActor.update({
        where: {
          oid: d.identityActor.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
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

  async archiveIdentityActor(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityActor: IdentityActor;
  }) {
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

    return withTransaction(async db => {
      let identityActor = await db.identityActor.update({
        where: {
          oid: existingIdentityActor.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
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
