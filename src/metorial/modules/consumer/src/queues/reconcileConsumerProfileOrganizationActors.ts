import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { consumerProfileService } from '../services';

export let RECONCILE_CONSUMER_PROFILE_ORGANIZATION_ACTORS_BATCH_SIZE = 500;

export let reconcileConsumerProfileOrganizationActorsCron = createCron(
  {
    name: 'cons/profileOrgActor/rec/cron',
    cron: '30 5 * * *'
  },
  async () => {
    await reconcileConsumerProfileOrganizationActorsSearchQueue.add(
      {},
      { id: 'consumer-profile-organization-actors-reconcile-search' }
    );
  }
);

export let reconcileConsumerProfileOrganizationActorsSearchQueue = createQueue<{
  cursor?: string;
}>({
  name: 'cons/profileOrgActor/rec/search'
});

setTimeout(() => {
  reconcileConsumerProfileOrganizationActorsSearchQueue.add(
    {},
    { id: 'consumer-profile-organization-actors-reconcile-search' }
  );
}, 10000);

export let reconcileConsumerProfileOrganizationActorsSearchQueueProcessor =
  reconcileConsumerProfileOrganizationActorsSearchQueue.process(async data => {
    let consumerProfiles = await db.consumerProfile.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_CONSUMER_PROFILE_ORGANIZATION_ACTORS_BATCH_SIZE,
      select: { id: true }
    });
    if (consumerProfiles.length === 0) return;

    await reconcileConsumerProfileOrganizationActorQueue.addManyWithOps(
      consumerProfiles.map(consumerProfile => ({
        data: { consumerProfileId: consumerProfile.id },
        opts: { id: consumerProfile.id }
      }))
    );

    let lastConsumerProfile = consumerProfiles[consumerProfiles.length - 1];
    if (!lastConsumerProfile) return;

    await reconcileConsumerProfileOrganizationActorsSearchQueue.add({
      cursor: lastConsumerProfile.id
    });
  });

export let reconcileConsumerProfileOrganizationActorQueue = createQueue<{
  consumerProfileId: string;
}>({
  name: 'cons/profileOrgActor/rec/single',
  workerOpts: {
    concurrency: 5
  }
});

export let reconcileConsumerProfileOrganizationActorQueueProcessor =
  reconcileConsumerProfileOrganizationActorQueue.process(async data => {
    let consumerProfile = await db.consumerProfile.findUnique({
      where: { id: data.consumerProfileId }
    });
    if (!consumerProfile) return;

    await consumerProfileService.reconcileConsumerProfileOrganizationActor({
      consumerProfile
    });
  });

export let reconcileConsumerProfileOrganizationActorsQueueProcessor = combineQueueProcessors([
  reconcileConsumerProfileOrganizationActorsCron,
  reconcileConsumerProfileOrganizationActorsSearchQueueProcessor,
  reconcileConsumerProfileOrganizationActorQueueProcessor
]);
