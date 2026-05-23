import { QueueRetryError, createQueue } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { reconcileAllTenantsManagedBackingsQueue } from './tenantManagedBackings';

let RECONCILE_BATCH_SIZE = 100;

let getManagedCredentialProviderReconcileUpdate = (managedCredentials: {
  providerOid: bigint | null;
  providerAuthMethodGlobalOid: bigint | null;
  name: string | null;
  description: string | null;
  metadata: unknown;
  initialProviderAuthMethod: {
    providerOid: bigint;
    globalOid: bigint;
  };
  providerAuthCredentials: {
    name: string | null;
    description: string | null;
    metadata: unknown;
  } | null;
}) => {
  let updateData: {
    providerOid?: bigint;
    providerAuthMethodGlobalOid?: bigint;
    name?: string | null;
    description?: string | null;
    metadata?: unknown;
  } = {};

  if (!managedCredentials.providerOid) {
    updateData.providerOid = managedCredentials.initialProviderAuthMethod.providerOid;
  }

  if (!managedCredentials.providerAuthMethodGlobalOid) {
    updateData.providerAuthMethodGlobalOid =
      managedCredentials.initialProviderAuthMethod.globalOid;
  }

  if (
    managedCredentials.name == null &&
    managedCredentials.providerAuthCredentials?.name != null
  ) {
    updateData.name = managedCredentials.providerAuthCredentials.name;
  }

  if (
    managedCredentials.description == null &&
    managedCredentials.providerAuthCredentials?.description != null
  ) {
    updateData.description = managedCredentials.providerAuthCredentials.description;
  }

  if (
    managedCredentials.metadata == null &&
    managedCredentials.providerAuthCredentials?.metadata != null
  ) {
    updateData.metadata = managedCredentials.providerAuthCredentials.metadata;
  }

  return Object.keys(updateData).length > 0 ? updateData : null;
};

export let reconcileManagedCredentialProviderManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'sub/auth/reconcile/mng/provider/many',
  redisUrl: env.service.REDIS_URL
});

export let reconcileManagedCredentialProviderManyQueueProcessor =
  reconcileManagedCredentialProviderManyQueue.process(async data => {
    let managedCredentialsList = await db.managedProviderAuthCredentials.findMany({
      where: {
        providerOid: null,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: {
        id: 'asc'
      },
      take: RECONCILE_BATCH_SIZE,
      select: {
        id: true
      }
    });
    if (managedCredentialsList.length === 0) return;

    await reconcileManagedCredentialProviderSingleQueue.addManyWithOps(
      managedCredentialsList.map(item => ({
        data: {
          managedProviderAuthCredentialsId: item.id
        },
        opts: {
          id: `single-${item.id}`
        }
      }))
    );

    await reconcileManagedCredentialProviderManyQueue.add({
      cursor: managedCredentialsList[managedCredentialsList.length - 1]!.id
    });
  });

export let reconcileManagedCredentialProviderSingleQueue = createQueue<{
  managedProviderAuthCredentialsId: string;
}>({
  name: 'sub/auth/reconcile/mng/provider/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10
  }
});

export let reconcileManagedCredentialProviderSingleQueueProcessor =
  reconcileManagedCredentialProviderSingleQueue.process(async data => {
    let managedCredentials = await db.managedProviderAuthCredentials.findUnique({
      where: {
        id: data.managedProviderAuthCredentialsId
      },
      include: {
        solution: {
          select: {
            id: true
          }
        },
        initialProviderAuthMethod: true,
        providerAuthCredentials: true
      }
    });
    if (!managedCredentials) throw new QueueRetryError();

    let updateData = getManagedCredentialProviderReconcileUpdate(managedCredentials);

    if (updateData) {
      await db.managedProviderAuthCredentials.update({
        where: {
          oid: managedCredentials.oid
        },
        data: updateData
      });
    }

    await reconcileAllTenantsManagedBackingsQueue.add(
      { solutionId: managedCredentials.solution.id },
      { id: `all-tenants-${managedCredentials.id}` }
    );
  });
