import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { metorialDb } from '@metorial-subspace/module-tenant';
import { env } from '../../env';

let OWNER_RECONCILE_BATCH_SIZE = 500;

let singleWorkerOpts = { concurrency: 5, limiter: { max: 20, duration: 1000 } };

let resolveConsumerOwnerActorOid = async (d: {
  instanceOid: bigint | null;
  privateMetadata: unknown;
}) => {
  let metadata = d.privateMetadata as Record<string, unknown> | null;
  if (metadata?.$owner !== 'consumer' || !d.instanceOid) return null;

  let consumerFilters =
    typeof metadata.consumerId === 'string'
      ? [
          { defaultForInstanceConsumer: { id: metadata.consumerId } },
          { instanceConsumer: { id: metadata.consumerId }, isDefault: true }
        ]
      : typeof metadata.consumerProfileOid === 'string' &&
          /^\d+$/.test(metadata.consumerProfileOid)
        ? [{ consumerProfileOid: BigInt(metadata.consumerProfileOid), isDefault: true }]
        : [];
  if (!consumerFilters.length) return null;

  let instance = await db.instance.findUnique({
    where: { oid: d.instanceOid },
    select: { id: true }
  });
  if (!instance) return null;

  let consumerActor: { id: string } | null = null;
  for (let consumerFilter of consumerFilters) {
    consumerActor = await metorialDb.consumerActor.findFirst({
      where: { ...consumerFilter, instance: { id: instance.id } },
      orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
      select: { id: true }
    });
    if (consumerActor) break;
  }
  if (!consumerActor) return null;

  let identityActor = await db.identityActor.findUnique({
    where: { id: consumerActor.id },
    select: { oid: true }
  });

  return identityActor?.oid ?? null;
};

let resolveIntegrationSetupSessionOwnerActorOid = async (session: {
  ownerActorOid: bigint | null;
  instanceOid: bigint | null;
  privateMetadata: unknown;
  integrationInstance: { identityActorOid: bigint | null };
}) =>
  session.ownerActorOid ??
  session.integrationInstance.identityActorOid ??
  (await resolveConsumerOwnerActorOid(session));

let integrationSetupSessionOwnerSelect = {
  ownerActorOid: true,
  instanceOid: true,
  privateMetadata: true,
  integrationInstance: { select: { identityActorOid: true } }
} as const;

let resolveProviderSetupSessionOwnerActorOid = async (providerSetupSessionOid: bigint) => {
  let session = await db.providerSetupSession.findUnique({
    where: { oid: providerSetupSessionOid },
    select: {
      ownerActorOid: true,
      instanceOid: true,
      privateMetadata: true,
      identity: { select: { actorOid: true } },
      integrationSetupSessionProvider: {
        select: {
          integrationSetupSession: { select: integrationSetupSessionOwnerSelect }
        }
      }
    }
  });
  if (!session) return null;
  if (session.ownerActorOid) return session.ownerActorOid;

  let integrationSetupSession =
    session.integrationSetupSessionProvider?.integrationSetupSession;

  return (
    (await resolveConsumerOwnerActorOid(session)) ??
    (integrationSetupSession
      ? await resolveIntegrationSetupSessionOwnerActorOid(integrationSetupSession)
      : null) ??
    session.identity?.actorOid ??
    null
  );
};

export let ownerActorReconcileCron = createCron(
  {
    name: 'sub/int/cron/ownerActorReconcile',
    cron: '45 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await reconcileIntegrationInstanceActorsManyQueue.add({});
    await reconcileIntegrationSetupSessionOwnersManyQueue.add({});
    await reconcileProviderSetupSessionOwnersManyQueue.add({});
    await reconcileProviderConfigOwnersManyQueue.add({});
    await reconcileProviderAuthConfigOwnersManyQueue.add({});
    await reconcileMagicMcpServerBackingIdentitiesManyQueue.add({});
  }
);

export let reconcileIntegrationInstanceActorsManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/int/ownerActor/integrationInstance/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reconcileIntegrationInstanceActorsManyQueueProcessor =
  reconcileIntegrationInstanceActorsManyQueue.process(async data => {
    let integrationInstances = await db.integrationInstance.findMany({
      where: {
        identityActorOid: null,
        integrationSetupSessions: {
          some: { privateMetadata: { path: ['$owner'], equals: 'consumer' } }
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: OWNER_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!integrationInstances.length) return;

    await reconcileIntegrationInstanceActorQueue.addManyWithOps(
      integrationInstances.map(integrationInstance => ({
        data: { integrationInstanceId: integrationInstance.id },
        opts: { id: integrationInstance.id }
      }))
    );

    if (integrationInstances.length === OWNER_RECONCILE_BATCH_SIZE) {
      await reconcileIntegrationInstanceActorsManyQueue.add(
        { cursor: integrationInstances[integrationInstances.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileIntegrationInstanceActorQueue = createQueue<{
  integrationInstanceId: string;
}>({
  name: 'sub/int/ownerActor/integrationInstance/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: singleWorkerOpts
});

// Writes the row directly instead of firing integrationInstance.updated, so linked session
// templates (and the sessions they spawn) only pick the actor up on the instance's next update.
export let reconcileIntegrationInstanceActorQueueProcessor =
  reconcileIntegrationInstanceActorQueue.process(async data => {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: data.integrationInstanceId },
      select: {
        oid: true,
        tenantOid: true,
        identityActorOid: true,
        identity: { select: { actorOid: true } },
        integrationSetupSessions: {
          where: { privateMetadata: { path: ['$owner'], equals: 'consumer' } },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { instanceOid: true, privateMetadata: true }
        }
      }
    });
    if (!integrationInstance || integrationInstance.identityActorOid) return;

    let setupSession = integrationInstance.integrationSetupSessions[0];
    if (!setupSession) return;

    let identityActorOid = await resolveConsumerOwnerActorOid(setupSession);
    if (!identityActorOid) return;

    let identityActor = await db.identityActor.findUnique({
      where: { oid: identityActorOid },
      select: { tenantOid: true }
    });
    if (identityActor?.tenantOid !== integrationInstance.tenantOid) return;

    if (
      integrationInstance.identity &&
      integrationInstance.identity.actorOid !== identityActorOid
    ) {
      return;
    }

    await db.integrationInstance.updateMany({
      where: { oid: integrationInstance.oid, identityActorOid: null },
      data: { identityActorOid }
    });
  });

export let reconcileIntegrationSetupSessionOwnersManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/int/ownerActor/integrationSetupSession/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reconcileIntegrationSetupSessionOwnersManyQueueProcessor =
  reconcileIntegrationSetupSessionOwnersManyQueue.process(async data => {
    let sessions = await db.integrationSetupSession.findMany({
      where: {
        ownerActorOid: null,
        OR: [
          { integrationInstance: { identityActorOid: { not: null } } },
          { privateMetadata: { path: ['$owner'], equals: 'consumer' } }
        ],
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: OWNER_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!sessions.length) return;

    await reconcileIntegrationSetupSessionOwnerQueue.addManyWithOps(
      sessions.map(session => ({
        data: { integrationSetupSessionId: session.id },
        opts: { id: session.id }
      }))
    );

    if (sessions.length === OWNER_RECONCILE_BATCH_SIZE) {
      await reconcileIntegrationSetupSessionOwnersManyQueue.add(
        { cursor: sessions[sessions.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileIntegrationSetupSessionOwnerQueue = createQueue<{
  integrationSetupSessionId: string;
}>({
  name: 'sub/int/ownerActor/integrationSetupSession/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: singleWorkerOpts
});

export let reconcileIntegrationSetupSessionOwnerQueueProcessor =
  reconcileIntegrationSetupSessionOwnerQueue.process(async data => {
    let session = await db.integrationSetupSession.findUnique({
      where: { id: data.integrationSetupSessionId },
      select: { oid: true, ...integrationSetupSessionOwnerSelect }
    });
    if (!session || session.ownerActorOid) return;

    let ownerActorOid = await resolveIntegrationSetupSessionOwnerActorOid(session);
    if (!ownerActorOid) return;

    await db.integrationSetupSession.updateMany({
      where: { oid: session.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  });

export let reconcileProviderSetupSessionOwnersManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/int/ownerActor/providerSetupSession/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reconcileProviderSetupSessionOwnersManyQueueProcessor =
  reconcileProviderSetupSessionOwnersManyQueue.process(async data => {
    let sessions = await db.providerSetupSession.findMany({
      where: {
        ownerActorOid: null,
        OR: [
          { identityOid: { not: null } },
          { integrationSetupSessionProviderOid: { not: null } },
          { privateMetadata: { path: ['$owner'], equals: 'consumer' } }
        ],
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: OWNER_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!sessions.length) return;

    await reconcileProviderSetupSessionOwnerQueue.addManyWithOps(
      sessions.map(session => ({
        data: { providerSetupSessionId: session.id },
        opts: { id: session.id }
      }))
    );

    if (sessions.length === OWNER_RECONCILE_BATCH_SIZE) {
      await reconcileProviderSetupSessionOwnersManyQueue.add(
        { cursor: sessions[sessions.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileProviderSetupSessionOwnerQueue = createQueue<{
  providerSetupSessionId: string;
}>({
  name: 'sub/int/ownerActor/providerSetupSession/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: singleWorkerOpts
});

export let reconcileProviderSetupSessionOwnerQueueProcessor =
  reconcileProviderSetupSessionOwnerQueue.process(async data => {
    let session = await db.providerSetupSession.findUnique({
      where: { id: data.providerSetupSessionId },
      select: { oid: true, ownerActorOid: true }
    });
    if (!session || session.ownerActorOid) return;

    let ownerActorOid = await resolveProviderSetupSessionOwnerActorOid(session.oid);
    if (!ownerActorOid) return;

    await db.providerSetupSession.updateMany({
      where: { oid: session.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  });

export let reconcileProviderConfigOwnersManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/int/ownerActor/providerConfig/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reconcileProviderConfigOwnersManyQueueProcessor =
  reconcileProviderConfigOwnersManyQueue.process(async data => {
    let configs = await db.providerConfig.findMany({
      where: {
        ownerActorOid: null,
        isDefault: false,
        isForVault: false,
        OR: [
          { providerSetupSessions: { some: {} } },
          { owningIntegrationInstanceProviderOid: { not: null } }
        ],
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: OWNER_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!configs.length) return;

    await reconcileProviderConfigOwnerQueue.addManyWithOps(
      configs.map(config => ({
        data: { providerConfigId: config.id },
        opts: { id: config.id }
      }))
    );

    if (configs.length === OWNER_RECONCILE_BATCH_SIZE) {
      await reconcileProviderConfigOwnersManyQueue.add(
        { cursor: configs[configs.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileProviderConfigOwnerQueue = createQueue<{ providerConfigId: string }>({
  name: 'sub/int/ownerActor/providerConfig/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: singleWorkerOpts
});

export let reconcileProviderConfigOwnerQueueProcessor =
  reconcileProviderConfigOwnerQueue.process(async data => {
    let config = await db.providerConfig.findUnique({
      where: { id: data.providerConfigId },
      select: {
        oid: true,
        ownerActorOid: true,
        providerSetupSessions: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { oid: true }
        },
        owningIntegrationInstanceProvider: {
          select: { integrationInstance: { select: { identityActorOid: true } } }
        }
      }
    });
    if (!config || config.ownerActorOid) return;

    let creatingSession = config.providerSetupSessions[0];
    let ownerActorOid =
      (creatingSession
        ? await resolveProviderSetupSessionOwnerActorOid(creatingSession.oid)
        : null) ??
      config.owningIntegrationInstanceProvider?.integrationInstance.identityActorOid;
    if (!ownerActorOid) return;

    await db.providerConfig.updateMany({
      where: { oid: config.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  });

export let reconcileProviderAuthConfigOwnersManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/int/ownerActor/providerAuthConfig/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reconcileProviderAuthConfigOwnersManyQueueProcessor =
  reconcileProviderAuthConfigOwnersManyQueue.process(async data => {
    let authConfigs = await db.providerAuthConfig.findMany({
      where: {
        ownerActorOid: null,
        isDefault: false,
        OR: [
          { providerSetupSession: { isNot: null } },
          { owningIntegrationInstanceProviderOid: { not: null } }
        ],
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: OWNER_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!authConfigs.length) return;

    await reconcileProviderAuthConfigOwnerQueue.addManyWithOps(
      authConfigs.map(authConfig => ({
        data: { providerAuthConfigId: authConfig.id },
        opts: { id: authConfig.id }
      }))
    );

    if (authConfigs.length === OWNER_RECONCILE_BATCH_SIZE) {
      await reconcileProviderAuthConfigOwnersManyQueue.add(
        { cursor: authConfigs[authConfigs.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileProviderAuthConfigOwnerQueue = createQueue<{
  providerAuthConfigId: string;
}>({
  name: 'sub/int/ownerActor/providerAuthConfig/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: singleWorkerOpts
});

export let reconcileProviderAuthConfigOwnerQueueProcessor =
  reconcileProviderAuthConfigOwnerQueue.process(async data => {
    let authConfig = await db.providerAuthConfig.findUnique({
      where: { id: data.providerAuthConfigId },
      select: {
        oid: true,
        ownerActorOid: true,
        providerSetupSession: { select: { oid: true } },
        owningIntegrationInstanceProvider: {
          select: { integrationInstance: { select: { identityActorOid: true } } }
        }
      }
    });
    if (!authConfig || authConfig.ownerActorOid) return;

    let ownerActorOid =
      (authConfig.providerSetupSession
        ? await resolveProviderSetupSessionOwnerActorOid(authConfig.providerSetupSession.oid)
        : null) ??
      authConfig.owningIntegrationInstanceProvider?.integrationInstance.identityActorOid;
    if (!ownerActorOid) return;

    await db.providerAuthConfig.updateMany({
      where: { oid: authConfig.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  });

export let reconcileMagicMcpServerBackingIdentitiesManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'sub/int/ownerActor/magicMcpServerBacking/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reconcileMagicMcpServerBackingIdentitiesManyQueueProcessor =
  reconcileMagicMcpServerBackingIdentitiesManyQueue.process(async data => {
    let backings = await db.magicMcpServerBacking.findMany({
      where: {
        identityOid: null,
        integrationInstance: { identityOid: { not: null } },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: OWNER_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!backings.length) return;

    await reconcileMagicMcpServerBackingIdentityQueue.addManyWithOps(
      backings.map(backing => ({
        data: { magicMcpServerBackingId: backing.id },
        opts: { id: backing.id }
      }))
    );

    if (backings.length === OWNER_RECONCILE_BATCH_SIZE) {
      await reconcileMagicMcpServerBackingIdentitiesManyQueue.add(
        { cursor: backings[backings.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileMagicMcpServerBackingIdentityQueue = createQueue<{
  magicMcpServerBackingId: string;
}>({
  name: 'sub/int/ownerActor/magicMcpServerBacking/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: singleWorkerOpts
});

export let reconcileMagicMcpServerBackingIdentityQueueProcessor =
  reconcileMagicMcpServerBackingIdentityQueue.process(async data => {
    let backing = await db.magicMcpServerBacking.findUnique({
      where: { id: data.magicMcpServerBackingId },
      select: {
        oid: true,
        identityOid: true,
        integrationInstance: { select: { identityOid: true } }
      }
    });
    if (!backing || backing.identityOid) return;

    let identityOid = backing.integrationInstance?.identityOid;
    if (!identityOid) return;

    await db.magicMcpServerBacking.updateMany({
      where: { oid: backing.oid, identityOid: null },
      data: { identityOid }
    });
  });

export let ownerActorQueues = combineQueueProcessors([
  ownerActorReconcileCron,
  reconcileIntegrationInstanceActorsManyQueueProcessor,
  reconcileIntegrationInstanceActorQueueProcessor,
  reconcileIntegrationSetupSessionOwnersManyQueueProcessor,
  reconcileIntegrationSetupSessionOwnerQueueProcessor,
  reconcileProviderSetupSessionOwnersManyQueueProcessor,
  reconcileProviderSetupSessionOwnerQueueProcessor,
  reconcileProviderConfigOwnersManyQueueProcessor,
  reconcileProviderConfigOwnerQueueProcessor,
  reconcileProviderAuthConfigOwnersManyQueueProcessor,
  reconcileProviderAuthConfigOwnerQueueProcessor,
  reconcileMagicMcpServerBackingIdentitiesManyQueueProcessor,
  reconcileMagicMcpServerBackingIdentityQueueProcessor
]);
