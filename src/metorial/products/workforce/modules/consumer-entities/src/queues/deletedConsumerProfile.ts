import { db } from '@metorial/db';
import { db as subspaceDb } from '@metorial-subspace/db';
import { identityActorService, identityService } from '@metorial-subspace/module-identity';
import { metorialResourceService } from '@metorial-subspace/module-tenant';
import { combineQueueProcessors, createQueue } from '@metorial/queue';

let batchSize = 500;

export let archiveDeletedConsumerProfileActorsQueue = createQueue<{
  consumerProfileId: string;
  cursor?: string;
}>({
  name: 'cons/profile/deleted/actors/many',
  workerOpts: { concurrency: 1 }
});

export let archiveDeletedConsumerProfileActorsProcessor =
  archiveDeletedConsumerProfileActorsQueue.process(async data => {
    let profile = await db.consumerProfile.findUnique({
      where: { id: data.consumerProfileId }
    });
    if (!profile || profile.status !== 'deleted') return;
    await metorialResourceService.syncConsumerProfile(profile);

    let actors = await subspaceDb.identityActor.findMany({
      where: {
        consumerProfileOid: profile.oid,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: batchSize
    });
    await archiveDeletedConsumerProfileActorQueue.addMany(
      actors.map(actor => ({ consumerProfileId: profile.id, identityActorId: actor.id }))
    );
    if (actors.length === batchSize) {
      await archiveDeletedConsumerProfileActorsQueue.add(
        { ...data, cursor: actors[actors.length - 1]!.id },
        { delay: 1000 }
      );
    }
  });

let archiveDeletedConsumerProfileActorQueue = createQueue<{
  consumerProfileId: string;
  identityActorId: string;
}>({
  name: 'cons/profile/deleted/actors/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let archiveDeletedConsumerProfileActorProcessor =
  archiveDeletedConsumerProfileActorQueue.process(async data => {
    let profile = await db.consumerProfile.findUnique({
      where: { id: data.consumerProfileId },
      include: { instance: true }
    });
    if (!profile || profile.status !== 'deleted') return;
    let actor = await identityActorService.getIdentityActorById({
      instance: profile.instance,
      identityActorId: data.identityActorId,
      allowDeleted: true
    });
    if (actor.consumerProfileOid !== profile.oid) return;
    if (actor.status === 'active') {
      await identityActorService.archiveIdentityActor({
        instance: profile.instance,
        identityActor: actor,
        canEditConsumerActor: true
      });
    }
    await archiveDeletedConsumerProfileIdentitiesQueue.add(data);
  });

let archiveDeletedConsumerProfileIdentitiesQueue = createQueue<{
  consumerProfileId: string;
  identityActorId: string;
  cursor?: string;
}>({
  name: 'cons/profile/deleted/identities/many',
  workerOpts: { concurrency: 1 }
});

let archiveDeletedConsumerProfileIdentitiesProcessor =
  archiveDeletedConsumerProfileIdentitiesQueue.process(async data => {
    let identities = await subspaceDb.identity.findMany({
      where: {
        actor: {
          id: data.identityActorId,
          consumerProfile: { id: data.consumerProfileId, status: 'deleted' }
        },
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: batchSize
    });
    await archiveDeletedConsumerProfileIdentityQueue.addMany(
      identities.map(identity => ({ ...data, identityId: identity.id }))
    );
    if (identities.length === batchSize) {
      await archiveDeletedConsumerProfileIdentitiesQueue.add(
        { ...data, cursor: identities[identities.length - 1]!.id },
        { delay: 1000 }
      );
    }
  });

let archiveDeletedConsumerProfileIdentityQueue = createQueue<{
  consumerProfileId: string;
  identityId: string;
}>({
  name: 'cons/profile/deleted/identities/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let archiveDeletedConsumerProfileIdentityProcessor =
  archiveDeletedConsumerProfileIdentityQueue.process(async data => {
    let profile = await db.consumerProfile.findUnique({
      where: { id: data.consumerProfileId },
      include: { instance: true }
    });
    if (!profile || profile.status !== 'deleted') return;
    let identity = await identityService.getIdentityById({
      instance: profile.instance,
      identityId: data.identityId,
      allowDeleted: true
    });
    if (identity.status !== 'active') return;
    let actor = await subspaceDb.identityActor.findUnique({
      where: { oid: identity.actorOid },
      select: { consumerProfileOid: true }
    });
    if (actor?.consumerProfileOid !== profile.oid) return;
    await identityService.archiveIdentity({
      instance: profile.instance,
      identity,
      canEditConsumerActor: true
    });
  });

export let deletedConsumerProfileProcessors = combineQueueProcessors([
  archiveDeletedConsumerProfileActorsProcessor,
  archiveDeletedConsumerProfileActorProcessor,
  archiveDeletedConsumerProfileIdentitiesProcessor,
  archiveDeletedConsumerProfileIdentityProcessor
]);
