import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { identityDeletedQueue } from '../lifecycle/identity';

export let deleteIdentitiesForActorManyQueue = createQueue<{
  identityActorId: string;
  cursor?: string;
}>({
  name: 'sub/idn/identity/deleteForActor/many',
  redisUrl: env.service.REDIS_URL
});

export let deleteIdentitiesForActorManyQueueProcessor =
  deleteIdentitiesForActorManyQueue.process(async data => {
    let actor = await db.identityActor.findUnique({
      where: { id: data.identityActorId }
    });
    if (!actor) return;

    let list = await db.identity.findMany({
      where: {
        actorOid: actor.oid,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100
    });
    if (list.length === 0) return;

    await deleteIdentitiesForActorSingleQueue.addMany(
      list.map(i => ({ identityId: i.id, archivedAt: actor.archivedAt }))
    );

    await deleteIdentitiesForActorManyQueue.add({
      identityActorId: data.identityActorId,
      cursor: list[list.length - 1].id
    });
  });

export let deleteIdentitiesForActorSingleQueue = createQueue<{
  identityId: string;
  archivedAt: Date | null;
}>({
  name: 'sub/idn/identity/deleteForActor',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    concurrency: 10,
    limiter: {
      max: 20,
      duration: 1000
    }
  }
});

export let deleteIdentitiesForActorSingleQueueProcessor =
  deleteIdentitiesForActorSingleQueue.process(async data => {
    await db.identity.updateMany({
      where: { id: data.identityId },
      data: { status: 'archived', archivedAt: data.archivedAt ?? new Date() }
    });

    await identityDeletedQueue.add({ identityId: data.identityId });
  });
