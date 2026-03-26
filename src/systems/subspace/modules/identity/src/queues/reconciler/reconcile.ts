import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  db,
  type DelegatedIdentity,
  getId,
  IdentityDelegationPermissions,
  withTransaction
} from '@metorial-subspace/db';
import { env } from '../../../../agent/src/env';
import { FoldedMap } from '../../lib/foldedMap';
import {
  getMaxExpirationThatFulfilsPermissions,
  getPermissions
} from '../../lib/reconcileUtils';

export let reconcileQueue = createQueue<{ identityId: string }>({
  name: 'sub/idn/reconcile',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 3,
    limiter: {
      max: 1,
      duration: 1000
    }
  }
});

let lock = createLock({
  redisUrl: env.service.REDIS_URL,
  name: 'sub/idn/reconcile/lock'
});

export let reconcileQueueProcessor = reconcileQueue.process(data =>
  lock.usingLock(data.identityId, async () => {
    let identity = await db.identity.findUnique({
      where: { id: data.identityId },
      include: { tenant: true }
    });
    if (!identity) throw new QueueRetryError();

    let delegatedActors = await db.identityDelegation.groupBy({
      where: { identityOid: identity.oid },
      by: ['delegateeOid']
    });

    await withTransaction(async db => {
      await db.identity.updateMany({
        where: { id: data.identityId },
        data: { needsReconciliation: false }
      });

      if (identity.status !== 'active') {
        await db.delegatedIdentity.updateMany({
          where: { identityOid: identity.oid },
          data: {
            isActive: false,
            permissions: [],
            delegationLevel: 0,
            atLeastHoldsUntil: null
          }
        });

        await db.delegatedIdentityCredential.updateMany({
          where: {
            delegatedIdentity: {
              identityOid: identity.oid
            }
          },
          data: { isActive: false, permissions: [], atLeastHoldsUntil: null }
        });

        return;
      }

      for (let { delegateeOid } of delegatedActors) {
        let delegations = await db.identityDelegation.findMany({
          where: {
            identityOid: identity.oid,
            delegateeOid,
            status: 'active',

            // If the delegation was auto-approved because it was covered by
            // a previous delegation, we don't want to consider it for the reconciliation,
            // because it doesn't have a real delegation consent behind it
            wasCoveredByPreviousDelegationAndAutoApproved: false,

            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          include: {
            credentials: {
              where: {
                status: 'active',
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
              }
            }
          }
        });

        let existingDelegation = await db.delegatedIdentity.findUnique({
          where: {
            identityOid_actorOid: {
              identityOid: identity.oid,
              actorOid: delegateeOid
            }
          },
          include: { credentials: true }
        });
        let existingCredentialsMap = new Map(
          existingDelegation?.credentials.map(c => [c.credentialOid, c]) ?? []
        );

        let currentGlobalPermissions = getPermissions(delegations);

        let atLeastHoldsUntil = getMaxExpirationThatFulfilsPermissions(
          currentGlobalPermissions,
          delegations
        );

        let permissions = Array.from(currentGlobalPermissions);
        let delegationLevel = Math.max(...delegations.map(d => d.delegationLevel), 0);
        let hasGlobalPermissions = permissions.length > 0;
        let hasSubPermissions = delegations
          .flatMap(d => d.credentials)
          .some(c => c.permissions.length > 0);
        let hasAnyPermissions = hasGlobalPermissions || hasSubPermissions;

        let upsertDelegatedIdentityInner = {
          permissions,
          delegationLevel,
          atLeastHoldsUntil:
            permissions.length && atLeastHoldsUntil ? new Date(atLeastHoldsUntil) : null,
          isActive: hasAnyPermissions
        };

        let delegationUpdateOid: bigint | null = null;

        let delegatedIdentity: DelegatedIdentity;
        if (existingDelegation) {
          delegatedIdentity = await db.delegatedIdentity.update({
            where: { id: existingDelegation.id },
            data: upsertDelegatedIdentityInner
          });

          let updateRes = await db.delegatedIdentityUpdate.create({
            data: {
              ...getId('delegatedIdentityUpdate'),
              delegatedIdentityOid: existingDelegation.oid,
              isActiveBefore: existingDelegation.isActive,
              isActiveAfter: upsertDelegatedIdentityInner.isActive,
              delegationLevelBefore: existingDelegation.delegationLevel,
              delegationLevelAfter: upsertDelegatedIdentityInner.delegationLevel,
              permissionsBefore: existingDelegation.permissions,
              permissionsAfter: upsertDelegatedIdentityInner.permissions
            },
            select: { oid: true }
          });
          delegationUpdateOid = updateRes.oid;
        } else {
          delegatedIdentity = await db.delegatedIdentity.create({
            data: {
              ...getId('delegatedIdentity'),
              identityOid: identity.oid,
              actorOid: delegateeOid,
              ...upsertDelegatedIdentityInner
            }
          });
        }

        let credentialOverrides = new FoldedMap<
          bigint,
          { permissions: IdentityDelegationPermissions[]; expiresAt: Date | null }
        >();

        for (let delegation of delegations) {
          for (let credential of delegation.credentials) {
            credentialOverrides.put(credential.credentialOid, {
              permissions: credential.permissions,
              expiresAt: credential.expiresAt
            });
          }
        }

        let foldedCredentialOverrides = credentialOverrides.fold();
        for (let [credentialOid, inner] of foldedCredentialOverrides) {
          let existingCredential = existingCredentialsMap.get(credentialOid);

          let currentPermissions = getPermissions(inner);
          let atLeastHoldsUntil = getMaxExpirationThatFulfilsPermissions(
            currentPermissions,
            inner
          );

          let permissions = Array.from(currentPermissions);

          let upsertData = {
            permissions,
            atLeastHoldsUntil:
              permissions.length && atLeastHoldsUntil ? new Date(atLeastHoldsUntil) : null,

            // It's even active if it doesn't have any permissions,
            // because it can override the global permissions of the delegated identity
            // i.e., go from some permissions to no permissions
            isActive: true
          };

          if (existingCredential) {
            let res = await db.delegatedIdentityCredential.update({
              where: { id: existingCredential.id },
              data: upsertData
            });

            await db.delegatedIdentityCredentialUpdate.createMany({
              data: {
                ...getId('delegatedIdentityUpdateCredential'),
                delegatedCredentialOid: res.oid,
                updateOid: delegationUpdateOid!,
                permissionsBefore: existingCredential.permissions,
                permissionsAfter: upsertData.permissions,
                isActiveBefore: existingCredential.isActive,
                isActiveAfter: upsertData.isActive
              }
            });
          } else {
            await db.delegatedIdentityCredential.createMany({
              data: {
                ...getId('delegatedIdentityCredential'),
                delegatedIdentityOid: delegatedIdentity.oid,
                credentialOid,
                ...upsertData
              }
            });
          }
        }

        let addedOrUpdatedCredentialOids = new Set(
          foldedCredentialOverrides.map(([oid]) => oid)
        );
        let nowInactiveCredentials =
          existingDelegation?.credentials.filter(
            c => !addedOrUpdatedCredentialOids.has(c.credentialOid)
          ) ?? [];

        await db.delegatedIdentityCredential.updateMany({
          where: {
            id: { in: nowInactiveCredentials.map(c => c.id) }
          },
          data: {
            isActive: false,
            permissions: [],
            atLeastHoldsUntil: null
          }
        });

        await db.delegatedIdentityCredentialUpdate.createMany({
          data: nowInactiveCredentials.map(c => ({
            ...getId('delegatedIdentityUpdateCredential'),
            delegatedCredentialOid: c.oid,
            updateOid: delegationUpdateOid!,
            permissionsBefore: c.permissions,
            permissionsAfter: [],
            isActiveBefore: c.isActive,
            isActiveAfter: false
          }))
        });
      }
    });
  })
);
