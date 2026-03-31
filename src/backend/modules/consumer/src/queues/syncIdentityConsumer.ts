import { createQueue } from '@metorial/queue';

export let syncIdentityConsumerQueue = createQueue<{
  identityConsumerId: string;
}>({
  name: 'cons/ident/sync'
});

export let syncIdentityConsumerQueueProcessor = syncIdentityConsumerQueue.process(
  async d => {}
);
