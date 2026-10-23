import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';

let RESOURCE_OWNER_RECONCILE_BATCH_SIZE = 500;

let singleWorkerOpts = { concurrency: 5, limiter: { max: 20, duration: 1000 } };

let consumerActor = { type: 'consumer' as const };

let consumerActorOid = (
  actor: { oid: bigint; type: string } | null | undefined
): bigint | null => (actor?.type === 'consumer' ? actor.oid : null);

let actorSelect = { select: { oid: true, type: true } } as const;

type ResourceOwnerReconcilerSpec = {
  key: string;
  listCandidateIds: (cursor: string | undefined, take: number) => Promise<string[]>;
  reconcile: (id: string) => Promise<void>;
};

let createResourceOwnerReconciler = (spec: ResourceOwnerReconcilerSpec) => {
  let singleQueue = createQueue<{ id: string }>({
    name: `sub/int/resourceOwner/${spec.key}/single`,
    redisUrl: env.service.REDIS_URL,
    workerOpts: singleWorkerOpts
  });

  let manyQueue = createQueue<{ cursor?: string }>({
    name: `sub/int/resourceOwner/${spec.key}/many`,
    redisUrl: env.service.REDIS_URL,
    workerOpts: { concurrency: 1 }
  });

  let manyProcessor = manyQueue.process(async data => {
    let ids = await spec.listCandidateIds(data.cursor, RESOURCE_OWNER_RECONCILE_BATCH_SIZE);
    if (!ids.length) return;

    await singleQueue.addManyWithOps(ids.map(id => ({ data: { id }, opts: { id } })));

    if (ids.length === RESOURCE_OWNER_RECONCILE_BATCH_SIZE) {
      await manyQueue.add({ cursor: ids[ids.length - 1]! }, dailyPacedDelay());
    }
  });

  let singleProcessor = singleQueue.process(async data => {
    await spec.reconcile(data.id);
  });

  return { manyQueue, processors: [manyProcessor, singleProcessor] };
};

let cursorWhere = (cursor: string | undefined) => (cursor ? { gt: cursor } : undefined);

let integrationInstanceOwners = createResourceOwnerReconciler({
  key: 'integrationInstance',
  listCandidateIds: async (cursor, take) => {
    let rows = await db.integrationInstance.findMany({
      where: { ownerActorOid: null, identityActor: consumerActor, id: cursorWhere(cursor) },
      orderBy: { id: 'asc' },
      take,
      select: { id: true }
    });
    return rows.map(row => row.id);
  },
  reconcile: async id => {
    let row = await db.integrationInstance.findUnique({
      where: { id },
      select: { oid: true, ownerActorOid: true, identityActor: actorSelect }
    });
    let ownerActorOid = consumerActorOid(row?.identityActor);
    if (!row || row.ownerActorOid || !ownerActorOid) return;

    await db.integrationInstance.updateMany({
      where: { oid: row.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  }
});

let integrationInstanceGroupOwners = createResourceOwnerReconciler({
  key: 'integrationInstanceGroup',
  listCandidateIds: async (cursor, take) => {
    let rows = await db.integrationInstanceGroup.findMany({
      where: { ownerActorOid: null, identityActor: consumerActor, id: cursorWhere(cursor) },
      orderBy: { id: 'asc' },
      take,
      select: { id: true }
    });
    return rows.map(row => row.id);
  },
  reconcile: async id => {
    let row = await db.integrationInstanceGroup.findUnique({
      where: { id },
      select: { oid: true, ownerActorOid: true, identityActor: actorSelect }
    });
    let ownerActorOid = consumerActorOid(row?.identityActor);
    if (!row || row.ownerActorOid || !ownerActorOid) return;

    await db.integrationInstanceGroup.updateMany({
      where: { oid: row.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  }
});

let sessionTemplateOwners = createResourceOwnerReconciler({
  key: 'sessionTemplate',
  listCandidateIds: async (cursor, take) => {
    let rows = await db.sessionTemplate.findMany({
      where: {
        ownerActorOid: null,
        OR: [
          { identityActor: consumerActor },
          { integrationInstance: { ownerActorOid: { not: null } } },
          { integrationInstanceGroup: { ownerActorOid: { not: null } } }
        ],
        id: cursorWhere(cursor)
      },
      orderBy: { id: 'asc' },
      take,
      select: { id: true }
    });
    return rows.map(row => row.id);
  },
  reconcile: async id => {
    let row = await db.sessionTemplate.findUnique({
      where: { id },
      select: {
        oid: true,
        ownerActorOid: true,
        identityActor: actorSelect,
        integrationInstance: { select: { ownerActorOid: true } },
        integrationInstanceGroup: { select: { ownerActorOid: true } }
      }
    });
    if (!row || row.ownerActorOid) return;

    let ownerActorOid =
      row.integrationInstance?.ownerActorOid ??
      row.integrationInstanceGroup?.ownerActorOid ??
      consumerActorOid(row.identityActor);
    if (!ownerActorOid) return;

    await db.sessionTemplate.updateMany({
      where: { oid: row.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  }
});

let ephemeralManagedSessionOwners = createResourceOwnerReconciler({
  key: 'ephemeralManagedSession',
  listCandidateIds: async (cursor, take) => {
    let rows = await db.ephemeralManagedSession.findMany({
      where: {
        ownerActorOid: null,
        OR: [{ actor: consumerActor }, { sessionTemplate: { ownerActorOid: { not: null } } }],
        id: cursorWhere(cursor)
      },
      orderBy: { id: 'asc' },
      take,
      select: { id: true }
    });
    return rows.map(row => row.id);
  },
  reconcile: async id => {
    let row = await db.ephemeralManagedSession.findUnique({
      where: { id },
      select: {
        oid: true,
        ownerActorOid: true,
        actor: actorSelect,
        sessionTemplate: { select: { ownerActorOid: true } }
      }
    });
    if (!row || row.ownerActorOid) return;

    let ownerActorOid = row.sessionTemplate.ownerActorOid ?? consumerActorOid(row.actor);
    if (!ownerActorOid) return;

    await db.ephemeralManagedSession.updateMany({
      where: { oid: row.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  }
});

let sessionOwners = createResourceOwnerReconciler({
  key: 'session',
  listCandidateIds: async (cursor, take) => {
    let rows = await db.session.findMany({
      where: {
        ownerActorOid: null,
        OR: [
          { identityActor: consumerActor },
          { ephemeralManagedSession: { ownerActorOid: { not: null } } }
        ],
        id: cursorWhere(cursor)
      },
      orderBy: { id: 'asc' },
      take,
      select: { id: true }
    });
    return rows.map(row => row.id);
  },
  reconcile: async id => {
    let row = await db.session.findUnique({
      where: { id },
      select: {
        oid: true,
        ownerActorOid: true,
        identityActor: actorSelect,
        ephemeralManagedSession: { select: { ownerActorOid: true } }
      }
    });
    if (!row || row.ownerActorOid) return;

    let ownerActorOid =
      row.ephemeralManagedSession?.ownerActorOid ?? consumerActorOid(row.identityActor);
    if (!ownerActorOid) return;

    await db.session.updateMany({
      where: { oid: row.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  }
});

let magicMcpServerBackingOwners = createResourceOwnerReconciler({
  key: 'magicMcpServerBacking',
  listCandidateIds: async (cursor, take) => {
    let rows = await db.magicMcpServerBacking.findMany({
      where: {
        ownerActorOid: null,
        OR: [
          { actor: consumerActor },
          { integrationInstance: { ownerActorOid: { not: null } } }
        ],
        id: cursorWhere(cursor)
      },
      orderBy: { id: 'asc' },
      take,
      select: { id: true }
    });
    return rows.map(row => row.id);
  },
  reconcile: async id => {
    let row = await db.magicMcpServerBacking.findUnique({
      where: { id },
      select: {
        oid: true,
        ownerActorOid: true,
        actor: actorSelect,
        integrationInstance: { select: { ownerActorOid: true } }
      }
    });
    if (!row || row.ownerActorOid) return;

    let ownerActorOid = row.integrationInstance.ownerActorOid ?? consumerActorOid(row.actor);
    if (!ownerActorOid) return;

    await db.magicMcpServerBacking.updateMany({
      where: { oid: row.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  }
});

let magicMcpEndpointBackingOwners = createResourceOwnerReconciler({
  key: 'magicMcpEndpointBacking',
  listCandidateIds: async (cursor, take) => {
    let rows = await db.magicMcpEndpointBacking.findMany({
      where: { ownerActorOid: null, actor: consumerActor, id: cursorWhere(cursor) },
      orderBy: { id: 'asc' },
      take,
      select: { id: true }
    });
    return rows.map(row => row.id);
  },
  reconcile: async id => {
    let row = await db.magicMcpEndpointBacking.findUnique({
      where: { id },
      select: { oid: true, ownerActorOid: true, actor: actorSelect }
    });
    let ownerActorOid = consumerActorOid(row?.actor);
    if (!row || row.ownerActorOid || !ownerActorOid) return;

    await db.magicMcpEndpointBacking.updateMany({
      where: { oid: row.oid, ownerActorOid: null },
      data: { ownerActorOid }
    });
  }
});

let resourceOwnerReconcilers = [
  integrationInstanceOwners,
  integrationInstanceGroupOwners,
  sessionTemplateOwners,
  ephemeralManagedSessionOwners,
  sessionOwners,
  magicMcpServerBackingOwners,
  magicMcpEndpointBackingOwners
];

export let resourceOwnerReconcileCron = createCron(
  {
    name: 'sub/int/cron/resourceOwnerReconcile',
    cron: '15 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    for (let reconciler of resourceOwnerReconcilers) {
      await reconciler.manyQueue.add({});
    }
  }
);

export let resourceOwnerQueues = combineQueueProcessors([
  resourceOwnerReconcileCron,
  ...resourceOwnerReconcilers.flatMap(reconciler => reconciler.processors)
]);
