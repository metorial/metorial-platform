import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { deleteIdentitiesForActorManyQueue } from '../archive/identity';
import { indexIdentityActorQueue } from '../search/actor';
import { lcOpts } from './_opts';

export let identityActorCreatedQueue = createQueue<{ identityActorId: string }>({
  name: 'sub/idn/lc/identityActor/created',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityActorCreatedQueueProcessor = identityActorCreatedQueue.process(
  async data => {
    await indexIdentityActorQueue.add({ identityActorId: data.identityActorId });
  }
);

export let identityActorUpdatedQueue = createQueue<{ identityActorId: string }>({
  name: 'sub/idn/lc/identityActor/updated',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityActorUpdatedQueueProcessor = identityActorUpdatedQueue.process(
  async data => {
    await indexIdentityActorQueue.add({ identityActorId: data.identityActorId });
  }
);

export let identityActorDeletedQueue = createQueue<{ identityActorId: string }>({
  name: 'sub/idn/lc/identityActor/deleted',
  redisUrl: env.service.REDIS_URL,
  ...lcOpts
});

export let identityActorDeletedQueueProcessor = identityActorDeletedQueue.process(
  async data => {
    await indexIdentityActorQueue.add({ identityActorId: data.identityActorId });

    await deleteIdentitiesForActorManyQueue.add({ identityActorId: data.identityActorId });
  }
);
