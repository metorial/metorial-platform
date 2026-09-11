import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { addAfterTransactionHook, db, getId, withTransaction } from '@metorial-subspace/db';
import { env } from '../../env';
import { reconcileQueue } from '../reconciler/reconcile';
import { lcOpts } from './_opts';

export let integrationInstanceProviderCredentialSyncQueue = createQueue<{
  integrationInstanceProviderId: string;
}>({
  name: 'sub/idn/lc/integrationInstanceProviderCredential/sync',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

let lock = createLock({
  name: 'sub/idn/lc/integrationInstanceProviderCredential/lock',
  redisUrl: env.service.REDIS_URL
});

export let integrationInstanceProviderCredentialSyncQueueProcessor =
  integrationInstanceProviderCredentialSyncQueue.process(data =>
    lock.usingLock(data.integrationInstanceProviderId, async () => {
      let integrationInstanceProvider = await db.integrationInstanceProvider.findUnique({
        where: { id: data.integrationInstanceProviderId },
        include: {
          integrationProvider: true,
          integrationInstance: {
            include: {
              identity: true
            }
          },
          currentVersion: {
            include: {
              integrationProviderVersion: true
            }
          }
        }
      });
      if (!integrationInstanceProvider) return;

      let existingCredential = await db.identityCredential.findUnique({
        where: {
          integrationInstanceProviderOid: integrationInstanceProvider.oid
        },
        include: {
          identity: true
        }
      });

      let identity = integrationInstanceProvider.integrationInstance.identity;
      let shouldBeActive =
        integrationInstanceProvider.status === 'active' &&
        !integrationInstanceProvider.isParentDeleted &&
        integrationInstanceProvider.integrationProvider.status === 'active' &&
        integrationInstanceProvider.integrationInstance.status !== 'archived' &&
        integrationInstanceProvider.integrationInstance.status !== 'deleted' &&
        !integrationInstanceProvider.integrationInstance.isParentDeleted &&
        !!integrationInstanceProvider.currentVersion &&
        !!identity &&
        identity.status === 'active' &&
        !identity.isParentDeleted;

      let affectedIdentityIds = new Set<string>();

      await withTransaction(async db => {
        if (!shouldBeActive) {
          if (existingCredential?.status === 'active') {
            await db.identityCredential.update({
              where: { oid: existingCredential.oid },
              data: {
                status: 'archived',
                archivedAt: new Date(),
                integrationInstanceOid: null,
                integrationInstanceProviderOid: null
              }
            });

            affectedIdentityIds.add(existingCredential.identity.id);
          }

          if (affectedIdentityIds.size) {
            await db.identity.updateMany({
              where: {
                id: { in: Array.from(affectedIdentityIds) }
              },
              data: { needsReconciliation: true }
            });

            await addAfterTransactionHook(async () =>
              reconcileQueue.addMany(
                Array.from(affectedIdentityIds).map(identityId => ({ identityId }))
              )
            );
          }

          return;
        }

        let desiredIdentity = identity!;
        let desiredCurrentVersion = integrationInstanceProvider.currentVersion!;
        let desiredDeploymentOid =
          desiredCurrentVersion.integrationProviderVersion.deploymentOid;
        let desiredConfigOid = desiredCurrentVersion.configOid;
        let desiredAuthConfigOid = desiredCurrentVersion.authConfigOid;
        let desiredProviderOid = integrationInstanceProvider.integrationProvider.providerOid;

        if (!existingCredential) {
          await db.identityCredential.create({
            data: {
              ...getId('identityCredential'),
              status: 'active',
              identityOid: desiredIdentity.oid,
              providerOid: desiredProviderOid,
              deploymentOid: desiredDeploymentOid,
              configOid: desiredConfigOid,
              authConfigOid: desiredAuthConfigOid,
              integrationInstanceOid: integrationInstanceProvider.integrationInstanceOid,
              integrationInstanceProviderOid: integrationInstanceProvider.oid
            }
          });

          affectedIdentityIds.add(desiredIdentity.id);
        } else {
          let hasChanged =
            existingCredential.status !== 'active' ||
            existingCredential.identityOid !== desiredIdentity.oid ||
            existingCredential.providerOid !== desiredProviderOid ||
            existingCredential.deploymentOid !== desiredDeploymentOid ||
            existingCredential.configOid !== desiredConfigOid ||
            existingCredential.authConfigOid !== desiredAuthConfigOid ||
            existingCredential.integrationInstanceOid !==
              integrationInstanceProvider.integrationInstanceOid ||
            existingCredential.integrationInstanceProviderOid !==
              integrationInstanceProvider.oid ||
            existingCredential.archivedAt !== null;

          if (hasChanged) {
            await db.identityCredential.update({
              where: { oid: existingCredential.oid },
              data: {
                status: 'active',
                archivedAt: null,
                identityOid: desiredIdentity.oid,
                providerOid: desiredProviderOid,
                deploymentOid: desiredDeploymentOid,
                configOid: desiredConfigOid,
                authConfigOid: desiredAuthConfigOid,
                integrationInstanceOid: integrationInstanceProvider.integrationInstanceOid,
                integrationInstanceProviderOid: integrationInstanceProvider.oid
              }
            });

            affectedIdentityIds.add(existingCredential.identity.id);
            affectedIdentityIds.add(desiredIdentity.id);
          }
        }

        if (affectedIdentityIds.size) {
          await db.identity.updateMany({
            where: {
              id: { in: Array.from(affectedIdentityIds) }
            },
            data: { needsReconciliation: true }
          });

          await addAfterTransactionHook(async () =>
            reconcileQueue.addMany(
              Array.from(affectedIdentityIds).map(identityId => ({ identityId }))
            )
          );
        }
      });
    })
  );
