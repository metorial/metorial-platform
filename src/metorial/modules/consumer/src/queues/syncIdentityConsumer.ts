import { db } from '@metorial/db';
import { createLock } from '@metorial/lock';
import {
  subspaceIdentityActorService,
  subspaceIdentityService
} from '@metorial/module-subspace';
import { createQueue, QueueRetryError } from '@metorial/queue';

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

let consumerActorLock = createLock({
  name: 'cons/ident/sync/actor'
});

export let reconcileConsumerActorQueueProcessor = reconcileConsumerActorQueue.process(
  async data =>
    await consumerActorLock.usingLock(data.profileId, async () => {
      let profile = await db.consumerProfile.findUnique({
        where: {
          id: data.profileId
        },
        include: { instance: true, actors: true, consumer: true }
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

      if (!profile.actors.length) {
        let actorRes = await subspaceIdentityActorService.create({
          instance: profile.instance,
          name: instanceConsumer.name,
          type: 'person',
          privateMetadata: {
            $owner: 'consumer',
            consumerProfileId: profile.id,
            instanceConsumerId: instanceConsumer.id,
            consumerId: profile.consumer.id
          }
        });
        let identityRes = await subspaceIdentityService.create({
          instance: profile.instance,
          identityActorId: actorRes.id,
          name: `Default Identity for ${instanceConsumer.name}`,
          inputs: [],
          privateMetadata: {
            $owner: 'consumer',
            consumerProfileId: profile.id,
            instanceConsumerId: instanceConsumer.id,
            consumerId: profile.consumer.id
          }
        });

        await db.consumerActor.create({
          data: {
            id: actorRes.id,
            instanceOid: profile.instanceOid,
            organizationOid: profile.organizationOid,

            consumerOid: profile.consumerOid,
            consumerProfileOid: profile.oid,
            instanceConsumerOid: instanceConsumer.oid,

            defaultIdentityId: identityRes.id,

            isDefault: true
          }
        });
      } else {
        for (let actor of profile.actors) {
          await subspaceIdentityActorService.update({
            instance: profile.instance,
            identityActorId: actor.id,
            name: instanceConsumer.name,

            canEditConsumerActor: true
          });
        }
      }
    })
);
