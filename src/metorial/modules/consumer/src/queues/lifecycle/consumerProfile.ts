import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { syncIdentityConsumerQueue } from '../syncIdentityConsumer';
import { syncPendingStatusForInstanceConsumer } from './pendingStatus';

let queueConsumerProfileSync = async (consumerProfileId: string) => {
  let consumerProfile = await db.consumerProfile.findUnique({
    where: {
      id: consumerProfileId
    },
    select: {
      id: true,
      instanceOid: true,
      consumerOid: true
    }
  });
  if (!consumerProfile) throw new QueueRetryError();

  let instanceConsumer = await db.instanceConsumer.findUnique({
    where: {
      instanceOid_consumerOid: {
        instanceOid: consumerProfile.instanceOid,
        consumerOid: consumerProfile.consumerOid
      }
    },
    select: {
      id: true
    }
  });
  if (!instanceConsumer) throw new QueueRetryError();

  await syncPendingStatusForInstanceConsumer(instanceConsumer.id);

  await syncIdentityConsumerQueue.add({
    identityConsumerId: instanceConsumer.id
  });
};

export let consumerProfileCreatedQueue = createQueue<{ consumerProfileId: string }>({
  name: 'cons/lc/profile/created'
});

export let consumerProfileCreatedQueueProcessor = consumerProfileCreatedQueue.process(
  async data => {
    await queueConsumerProfileSync(data.consumerProfileId);
  }
);

export let consumerProfileUpdatedQueue = createQueue<{ consumerProfileId: string }>({
  name: 'cons/lc/profile/updated'
});

export let consumerProfileUpdatedQueueProcessor = consumerProfileUpdatedQueue.process(
  async data => {
    await queueConsumerProfileSync(data.consumerProfileId);
  }
);
