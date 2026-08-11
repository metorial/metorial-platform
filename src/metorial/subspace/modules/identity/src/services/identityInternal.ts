import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Identity,
  type IdentityActor,
  type IntegrationInstance,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkDeletedRelation } from '@metorial-subspace/list-utils';
import { checkTenant, getMetorialSolution } from '@metorial-subspace/module-tenant';
import { env } from '../env';
import { identityCreatedQueue } from '../queues/lifecycle/identity';
import { integrationInstanceProviderCredentialSyncQueue } from '../queues/lifecycle/integrationInstanceProviderCredential';

let integrationOwnedIdentityLock = createLock({
  name: 'sub/idn/identity/integrationOwned/lock',
  redisUrl: env.service.REDIS_URL
});

let ownedByAnotherIntegrationInstanceError = (identityId: string) =>
  new ServiceError(
    badRequestError({
      message: 'Identity is already owned by another integration instance.',
      code: 'identity_owned_by_other_integration_instance',
      data: { identityId }
    })
  );

let ownedIdentityActorMismatchError = () =>
  new ServiceError(
    badRequestError({
      message: 'This integration instance already owns an identity for a different actor.',
      code: 'integration_instance_owned_identity_actor_mismatch'
    })
  );

class identityInternalServiceImpl {
  async ensureIntegrationIdentity(d: {
    tenant: Tenant;
    environment: Environment;
    integrationInstance: IntegrationInstance;
    actor?: IdentityActor | null;
    identityId?: string | null;
  }) {
    let solution = await getMetorialSolution();

    if (d.actor) {
      checkTenant(d, d.actor);
      checkDeletedRelation(d.actor);
    }

    if (d.identityId) {
      let identity = await db.identity.findFirst({
        where: {
          id: d.identityId,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        },
        include: {
          actor: true
        }
      });
      if (!identity) throw new ServiceError(notFoundError('identity', d.identityId));

      checkTenant(d, identity);
      checkDeletedRelation(identity);
      checkDeletedRelation(identity.actor);

      if (d.actor && identity.actorOid !== d.actor.oid) {
        throw new ServiceError(
          badRequestError({
            message: 'Identity does not belong to the selected actor.',
            code: 'identity_actor_mismatch'
          })
        );
      }

      if (
        identity.ownedByIntegrationInstanceOid &&
        identity.ownedByIntegrationInstanceOid !== d.integrationInstance.oid
      ) {
        throw ownedByAnotherIntegrationInstanceError(identity.id);
      }

      return {
        identity,
        actor: identity.actor
      };
    }

    if (!d.actor) {
      return {
        identity: null,
        actor: null
      };
    }

    let getOwnedIdentity = () =>
      db.identity.findFirst({
        where: {
          ownedByIntegrationInstanceOid: d.integrationInstance.oid
        },
        include: {
          actor: true
        }
      });

    let existing = await getOwnedIdentity();
    if (existing?.status === 'active' && !existing.isParentDeleted) {
      if (existing.actorOid !== d.actor.oid) {
        throw ownedIdentityActorMismatchError();
      }

      return {
        identity: existing,
        actor: d.actor
      };
    }

    return await integrationOwnedIdentityLock.usingLock(
      [d.integrationInstance.id],
      async () => {
        let lockedExisting = await getOwnedIdentity();
        if (lockedExisting?.status === 'active' && !lockedExisting.isParentDeleted) {
          if (lockedExisting.actorOid !== d.actor!.oid) {
            throw ownedIdentityActorMismatchError();
          }

          return {
            identity: lockedExisting,
            actor: d.actor!
          };
        }

        if (lockedExisting) {
          if (lockedExisting.actorOid !== d.actor!.oid) {
            throw ownedIdentityActorMismatchError();
          }

          return await withTransaction(async db => {
            let identity = await db.identity.update({
              where: { oid: lockedExisting.oid },
              data: {
                status: 'active',
                isParentDeleted: false,
                archivedAt: null,
                needsReconciliation: true,
                name: d.actor!.name,
                description: d.actor!.description,
                metadata: d.actor!.metadata
              }
            });

            await addAfterTransactionHook(async () =>
              identityCreatedQueue.add({ identityId: identity.id })
            );

            return {
              identity,
              actor: d.actor!
            };
          });
        }

        return await withTransaction(async db => {
          let identity: Identity = await db.identity.create({
            data: {
              ...getId('identity'),
              status: 'active',
              needsReconciliation: true,
              actorOid: d.actor!.oid,
              ownedByIntegrationInstanceOid: d.integrationInstance.oid,
              name: d.actor!.name,
              description: d.actor!.description,
              metadata: d.actor!.metadata,
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid
            }
          });

          await addAfterTransactionHook(async () =>
            identityCreatedQueue.add({ identityId: identity.id })
          );

          return {
            identity,
            actor: d.actor!
          };
        });
      }
    );
  }

  async syncIntegrationInstanceProviderCredential(d: {
    integrationInstanceProviderId: string;
  }) {
    await integrationInstanceProviderCredentialSyncQueue.add({
      integrationInstanceProviderId: d.integrationInstanceProviderId
    });
  }

  async syncIntegrationInstanceProviderCredentials(d: {
    integrationInstanceProviderIds: string[];
  }) {
    let integrationInstanceProviderIds = Array.from(
      new Set(d.integrationInstanceProviderIds.filter(Boolean))
    );
    if (integrationInstanceProviderIds.length === 0) return;

    await integrationInstanceProviderCredentialSyncQueue.addMany(
      integrationInstanceProviderIds.map(integrationInstanceProviderId => ({
        integrationInstanceProviderId
      }))
    );
  }
}

export let identityInternalService = Service.create(
  'identityInternal',
  () => new identityInternalServiceImpl()
).build();
