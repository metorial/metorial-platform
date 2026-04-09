import { db, withTransaction } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { consumerAresService } from '../../services/ares';

let disconnectConsumerSurfaceAres = async (d: {
  consumerSurface: {
    consumerAuthTenantOid?: bigint | null;
  };
  status: 'archived' | 'deleted';
}) => {
  if (!d.consumerSurface.consumerAuthTenantOid) return;
  let consumerAuthTenantOid = d.consumerSurface.consumerAuthTenantOid;

  await withTransaction(async tx => {
    let consumerAuthTenant = await tx.consumerAuthTenant.findUniqueOrThrow({
      where: {
        oid: consumerAuthTenantOid
      }
    });

    if (consumerAuthTenant.aresAppId) {
      await consumerAresService.updateApp({
        id: consumerAuthTenant.aresAppId,
        slug: consumerAuthTenant.aresAppSlug
          ? `${consumerAuthTenant.aresAppSlug}-${d.status}-${Date.now()}`
          : undefined,
        redirectDomains: ['invalid.invalid']
      });

      await tx.consumerAuthTenant.update({
        where: {
          oid: consumerAuthTenant.oid
        },
        data: {
          aresAppId: null,
          aresAppSlug: null,
          aresClientId: null
        }
      });
    }
  });
};

let deactivateConsumerSurfaceResources = async (d: {
  publishableApiKeyOid: bigint;
  consumerSurfaceOid?: bigint;
}) => {
  await withTransaction(async tx => {
    let now = new Date();

    if (d.consumerSurfaceOid) {
      await tx.consumerSession.updateMany({
        where: {
          loggedOutAt: null,
          consumerProfile: {
            surfaceOid: d.consumerSurfaceOid
          }
        },
        data: {
          loggedOutAt: now
        }
      });
    }

    let apiKey = await tx.apiKey.findUnique({
      where: {
        oid: d.publishableApiKeyOid
      },
      select: {
        machineAccessOid: true
      }
    });

    await tx.apiKey.update({
      where: {
        oid: d.publishableApiKeyOid
      },
      data: {
        status: 'deleted',
        deletedAt: now
      }
    });

    if (apiKey) {
      await tx.machineAccess.update({
        where: {
          oid: apiKey.machineAccessOid
        },
        data: {
          status: 'deleted',
          deletedAt: now
        }
      });
    }
  });
};

export let consumerSurfaceCreatedQueue = createQueue<{ consumerSurfaceId: string }>({
  name: 'cons/lc/surface/created'
});

export let consumerSurfaceCreatedQueueProcessor = consumerSurfaceCreatedQueue.process(
  async () => {}
);

export let consumerSurfaceUpdatedQueue = createQueue<{ consumerSurfaceId: string }>({
  name: 'cons/lc/surface/updated'
});

export let consumerSurfaceUpdatedQueueProcessor = consumerSurfaceUpdatedQueue.process(
  async () => {}
);

export let consumerSurfaceArchivedQueue = createQueue<{ consumerSurfaceId: string }>({
  name: 'cons/lc/surface/archived'
});

export let consumerSurfaceArchivedQueueProcessor = consumerSurfaceArchivedQueue.process(
  async data => {
    let consumerSurface = await db.consumerSurface.findUnique({
      where: {
        id: data.consumerSurfaceId
      },
      select: {
        oid: true,
        status: true,
        consumerAuthTenantOid: true,
        publishableApiKeyOid: true
      }
    });
    if (!consumerSurface || consumerSurface.status !== 'archived') return;

    await disconnectConsumerSurfaceAres({
      consumerSurface,
      status: 'archived'
    });

    await deactivateConsumerSurfaceResources({
      publishableApiKeyOid: consumerSurface.publishableApiKeyOid,
      consumerSurfaceOid: consumerSurface.oid
    });
  }
);

export let consumerSurfaceDeletedQueue = createQueue<{ consumerSurfaceId: string }>({
  name: 'cons/lc/surface/deleted'
});

export let consumerSurfaceDeletedQueueProcessor = consumerSurfaceDeletedQueue.process(
  async data => {
    let consumerSurface = await db.consumerSurface.findUnique({
      where: {
        id: data.consumerSurfaceId
      },
      select: {
        oid: true,
        status: true,
        consumerAuthTenantOid: true,
        publishableApiKeyOid: true
      }
    });
    if (!consumerSurface || consumerSurface.status !== 'deleted') return;

    await disconnectConsumerSurfaceAres({
      consumerSurface,
      status: 'deleted'
    });

    await deactivateConsumerSurfaceResources({
      publishableApiKeyOid: consumerSurface.publishableApiKeyOid,
      consumerSurfaceOid: consumerSurface.oid
    });
  }
);
