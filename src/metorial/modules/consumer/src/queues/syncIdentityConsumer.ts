import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { consumerActorService } from '../services/consumerEntities/consumerActor';

export let syncIdentityConsumerQueue = createQueue<{
  identityConsumerId: string;
}>({
  name: 'cons/ident/sync'
});

export let syncIdentityConsumerQueueProcessor = syncIdentityConsumerQueue.process(
  async data => {
    let instanceConsumer = await db.instanceConsumer.findUnique({
      where: {
        id: data.identityConsumerId
      }
    });
    if (!instanceConsumer) throw new QueueRetryError();

    await db.consumerProfile.updateMany({
      where: {
        instanceOid: instanceConsumer.instanceOid,
        consumerOid: instanceConsumer.consumerOid
      },
      data: {
        name: instanceConsumer.name,
        email: instanceConsumer.email
      }
    });

    let profiles = await db.consumerProfile.findMany({
      where: {
        instanceOid: instanceConsumer.instanceOid,
        consumerOid: instanceConsumer.consumerOid
      }
    });

    await reconcileConsumerActorQueue.addMany(
      profiles.map(p => ({
        profileId: p.id
      }))
    );
  }
);

export let reconcileConsumerActorQueue = createQueue<{
  profileId: string;
}>({
  name: 'cons/ident/recon-actor'
});

export let reconcileConsumerActorQueueProcessor = reconcileConsumerActorQueue.process(
  async data => {
    let profile = await db.consumerProfile.findUnique({
      where: {
        id: data.profileId
      },
      include: { instance: true }
    });
    if (!profile) throw new QueueRetryError();

    let instanceConsumer = await db.instanceConsumer.findUnique({
      where: {
        instanceOid_consumerOid: {
          instanceOid: profile.instanceOid,
          consumerOid: profile.consumerOid
        }
      }
    });
    if (!instanceConsumer) throw new QueueRetryError();

    await db.consumerProfile.updateMany({
      where: { oid: profile.oid },
      data: {
        name: instanceConsumer.name,
        email: instanceConsumer.email
      }
    });

    await consumerActorService.reconcileConsumerProfileActors({
      instance: profile.instance,
      consumerProfile: profile,
      name: instanceConsumer.name
    });
  }
);
