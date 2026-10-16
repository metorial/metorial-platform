import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import { db as subspaceDb } from '@metorial-subspace/db';
import { consumerActorService } from '../services/consumerActor';

let RECONCILE_BATCH_SIZE = 500;

export let syncInstanceConsumerActorsQueue = createQueue<{ instanceConsumerId: string }>({
  name: 'cons/actor/sync',
  workerOpts: { concurrency: 5, limiter: { max: 20, duration: 1000 } }
});

export let syncInstanceConsumerActorsProcessor = syncInstanceConsumerActorsQueue.process(
  async data => {
    await consumerActorService.syncInstanceConsumerActors({
      instanceConsumerId: data.instanceConsumerId
    });
  }
);

export let reconcileConsumerActorsCron = createCron(
  { name: 'cons/actor/reconcile/cron', cron: '0 3 * * *' },
  async () => {
    await reconcileProfilesWithoutActorManyQueue.add({});
    await reconcileInstanceConsumerActorsManyQueue.add({});
    await reconcileOrphanedConsumerActorsManyQueue.add({});
  }
);

export let reconcileProfilesWithoutActorManyQueue = createQueue<{ cursor?: string }>({
  name: 'cons/actor/reconcile/profile/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileProfilesWithoutActorManyProcessor =
  reconcileProfilesWithoutActorManyQueue.process(async data => {
    let profiles = await db.consumerProfile.findMany({
      where: {
        status: 'active',
        actors: { none: {} },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!profiles.length) return;

    await reconcileProfileWithoutActorSingleQueue.addManyWithOps(
      profiles.map(profile => ({
        data: { consumerProfileId: profile.id },
        opts: { id: profile.id }
      }))
    );

    if (profiles.length === RECONCILE_BATCH_SIZE) {
      await reconcileProfilesWithoutActorManyQueue.add(
        { cursor: profiles[profiles.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileProfileWithoutActorSingleQueue = createQueue<{
  consumerProfileId: string;
}>({
  name: 'cons/actor/reconcile/profile/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let reconcileProfileWithoutActorSingleProcessor =
  reconcileProfileWithoutActorSingleQueue.process(async data => {
    let consumerProfile = await db.consumerProfile.findUnique({
      where: { id: data.consumerProfileId },
      include: { instance: true }
    });
    if (!consumerProfile || consumerProfile.status !== 'active') return;

    await consumerActorService.ensureDefaultConsumerActor({
      instance: consumerProfile.instance,
      consumerProfile
    });
  });

export let reconcileInstanceConsumerActorsManyQueue = createQueue<{ cursor?: string }>({
  name: 'cons/actor/reconcile/ic/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileInstanceConsumerActorsManyProcessor =
  reconcileInstanceConsumerActorsManyQueue.process(async data => {
    let instanceConsumers = await db.instanceConsumer.findMany({
      where: {
        consumerActors: { some: {} },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!instanceConsumers.length) return;

    await syncInstanceConsumerActorsQueue.addMany(
      instanceConsumers.map(instanceConsumer => ({
        instanceConsumerId: instanceConsumer.id
      }))
    );

    if (instanceConsumers.length === RECONCILE_BATCH_SIZE) {
      await reconcileInstanceConsumerActorsManyQueue.add(
        { cursor: instanceConsumers[instanceConsumers.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileOrphanedConsumerActorsManyQueue = createQueue<{ cursor?: string }>({
  name: 'cons/actor/reconcile/orphan/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileOrphanedConsumerActorsManyProcessor =
  reconcileOrphanedConsumerActorsManyQueue.process(async data => {
    let identityActors = await subspaceDb.identityActor.findMany({
      where: {
        status: 'active',
        OR: [
          { type: 'consumer' },
          { privateMetadata: { path: ['$owner'], equals: 'consumer' } },
          { consumerOid: { not: null } },
          { instanceConsumerOid: { not: null } },
          { consumerProfileOid: { not: null } }
        ],
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_BATCH_SIZE,
      select: {
        id: true,
        type: true,
        consumerOid: true,
        instanceConsumerOid: true,
        consumerProfileOid: true
      }
    });
    if (!identityActors.length) return;

    let linkedActors = await db.consumerActor.findMany({
      where: { id: { in: identityActors.map(actor => actor.id) } },
      select: { id: true, instanceConsumer: { select: { id: true } } }
    });
    let linkedActorsById = new Map(linkedActors.map(actor => [actor.id, actor]));

    let orphanedActors = identityActors.filter(actor => !linkedActorsById.has(actor.id));
    let partiallyLinkedInstanceConsumerIds = new Set(
      identityActors
        .filter(
          actor =>
            actor.type !== 'consumer' ||
            !actor.consumerOid ||
            !actor.instanceConsumerOid ||
            !actor.consumerProfileOid
        )
        .flatMap(actor => {
          let linkedActor = linkedActorsById.get(actor.id);
          return linkedActor ? [linkedActor.instanceConsumer.id] : [];
        })
    );

    await reconcileOrphanedConsumerActorSingleQueue.addManyWithOps(
      orphanedActors.map(actor => ({
        data: { identityActorId: actor.id },
        opts: { id: actor.id }
      }))
    );

    await syncInstanceConsumerActorsQueue.addMany(
      [...partiallyLinkedInstanceConsumerIds].map(instanceConsumerId => ({
        instanceConsumerId
      }))
    );

    if (identityActors.length === RECONCILE_BATCH_SIZE) {
      await reconcileOrphanedConsumerActorsManyQueue.add(
        { cursor: identityActors[identityActors.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileOrphanedConsumerActorSingleQueue = createQueue<{
  identityActorId: string;
}>({
  name: 'cons/actor/reconcile/orphan/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let reconcileOrphanedConsumerActorSingleProcessor =
  reconcileOrphanedConsumerActorSingleQueue.process(async data => {
    let identityActor = await subspaceDb.identityActor.findUnique({
      where: { id: data.identityActorId },
      include: { instance: true, consumerProfile: true }
    });
    if (!identityActor || identityActor.status !== 'active') return;

    let existingConsumerActor = await db.consumerActor.findUnique({
      where: { id: identityActor.id },
      select: { oid: true }
    });
    if (existingConsumerActor) return;

    let privateMetadata = identityActor.privateMetadata as Record<string, unknown> | null;
    let consumerProfileId =
      identityActor.consumerProfile?.id ??
      (typeof privateMetadata?.consumerProfileId === 'string'
        ? privateMetadata.consumerProfileId
        : undefined);
    if (!consumerProfileId) return;

    let consumerProfile = await db.consumerProfile.findUnique({
      where: { id: consumerProfileId },
      include: { instance: true }
    });
    if (!consumerProfile || consumerProfile.instance.id !== identityActor.instance?.id) return;

    let instanceConsumer = await db.instanceConsumer.findUnique({
      where: {
        instanceOid_consumerOid: {
          instanceOid: consumerProfile.instanceOid,
          consumerOid: consumerProfile.consumerOid
        }
      },
      select: { oid: true, id: true }
    });
    if (!instanceConsumer) return;

    let [defaultIdentity, profileDefaultActor] = await Promise.all([
      subspaceDb.identity.findFirst({
        where: { actorOid: identityActor.oid, status: 'active' },
        orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
        select: { id: true }
      }),
      db.consumerActor.findFirst({
        where: { consumerProfileOid: consumerProfile.oid, isDefault: true },
        select: { oid: true }
      })
    ]);

    await db.consumerActor.create({
      data: {
        id: identityActor.id,
        organizationOid: consumerProfile.organizationOid,
        instanceOid: consumerProfile.instanceOid,
        consumerOid: consumerProfile.consumerOid,
        instanceConsumerOid: instanceConsumer.oid,
        consumerProfileOid: consumerProfile.oid,
        defaultIdentityId: defaultIdentity?.id,
        isDefault: !profileDefaultActor
      }
    });

    await syncInstanceConsumerActorsQueue.add({ instanceConsumerId: instanceConsumer.id });
  });

export let consumerActorSyncProcessors = combineQueueProcessors([
  syncInstanceConsumerActorsProcessor,
  reconcileConsumerActorsCron,
  reconcileProfilesWithoutActorManyProcessor,
  reconcileProfileWithoutActorSingleProcessor,
  reconcileInstanceConsumerActorsManyProcessor,
  reconcileOrphanedConsumerActorsManyProcessor,
  reconcileOrphanedConsumerActorSingleProcessor
]);
