import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Identity,
  type IdentityActor,
  type IdentityStatus,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveAgents,
  resolveIdentityActors
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  identityCreatedQueue,
  identityDeletedQueue,
  identityUpdatedQueue
} from '../queues/lifecycle/identity';
import { identityCredentialService, type IdentityCredentialInput } from './identityCredential';

let include = {
  actor: {
    include: {
      agent: true
    }
  },
  delegationConfig: true,
  credentials: {
    include: {
      identity: true,
      provider: true,
      deployment: true,
      config: true,
      authConfig: true,
      delegationConfig: true
    }
  }
};

class identityServiceImpl {
  async listIdentities(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: IdentityStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    agentIds?: string[];
    actorIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let agents = await resolveAgents(d, d.agentIds);
    let actors = await resolveIdentityActors(d, d.actorIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.identity.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.identity.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,

                agents ? { actor: { agent: agents.oidIn } } : undefined!,
                actors ? { actor: actors.oidIn } : undefined!,

                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getIdentityById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identityId: string;
    allowDeleted?: boolean;
  }) {
    let identity = await db.identity.findFirst({
      where: {
        id: d.identityId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!identity) throw new ServiceError(notFoundError('identity', d.identityId));

    return identity;
  }

  async createIdentity(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    actor: IdentityActor;

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;

      inputs: IdentityCredentialInput[];
    };
  }) {
    checkTenant(d, d.actor);
    checkDeletedRelation(d.actor);

    return withTransaction(async db => {
      let identity = await db.identity.create({
        data: {
          ...getId('identity'),

          status: 'active',

          needsReconciliation: true,

          actorOid: d.actor.oid,

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      });

      await identityCredentialService.internalCreateIdentityCredentials({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,

        identity,
        inputs: d.input.inputs
      });

      await addAfterTransactionHook(async () =>
        identityCreatedQueue.add({ identityId: identity.id })
      );

      return await db.identity.findFirstOrThrow({
        where: { oid: identity.oid },
        include
      });
    });
  }

  async updateIdentity(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identity: Identity;

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    checkTenant(d, d.identity);
    checkDeletedEdit(d.identity, 'update');

    return withTransaction(async db => {
      let identity = await db.identity.update({
        where: {
          oid: d.identity.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.identity.name,
          description: d.input.description ?? d.identity.description,
          metadata: d.input.metadata ?? d.identity.metadata
        },
        include
      });

      await addAfterTransactionHook(async () =>
        identityUpdatedQueue.add({ identityId: identity.id })
      );

      return identity;
    });
  }

  async archiveIdentity(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    identity: Identity;
  }) {
    checkTenant(d, d.identity);
    checkDeletedEdit(d.identity, 'archive');

    return withTransaction(async db => {
      let identity = await db.identity.update({
        where: {
          oid: d.identity.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date(),
          needsReconciliation: true
        },
        include
      });

      await addAfterTransactionHook(async () =>
        identityDeletedQueue.add({ identityId: identity.id })
      );

      return identity;
    });
  }
}

export let identityService = Service.create(
  'identity',
  () => new identityServiceImpl()
).build();
