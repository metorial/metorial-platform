import { createQueue } from '@metorial/queue';
import { syncUserUpdateConsumerManyQueue } from './syncUserUpdateToConsumers';
import { syncUserUpdateMemberManyQueue } from './syncUserUpdateToMembers';

export let syncUserUpdateQueue = createQueue<{ userId: string }>({
  name: 'usr/syncUserUpdate'
});

export let syncUserUpdateQueueProcessor = syncUserUpdateQueue.process(async data => {
  await syncUserUpdateConsumerManyQueue.add({
    userId: data.userId
  });

  await syncUserUpdateMemberManyQueue.add({
    userId: data.userId
  });
});
