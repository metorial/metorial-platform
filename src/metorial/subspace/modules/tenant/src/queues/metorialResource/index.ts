import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { metorialDb } from '../../lib/metorialDb';
import { metorialResourceService } from '../../services/metorialResource';

export let METORIAL_RESOURCE_SYNC_BATCH_SIZE = 500;
export let METORIAL_CONSUMER_SYNC_BATCH_SIZE = 500;

export let syncMetorialOrganizationQueue = createQueue<{ organizationId: string }>({
  name: 'sub/ten/metorial/org',
  redisUrl: env.service.REDIS_URL
});

export let syncMetorialProjectQueue = createQueue<{ projectId: string }>({
  name: 'sub/ten/metorial/project',
  redisUrl: env.service.REDIS_URL
});

export let syncMetorialInstanceQueue = createQueue<{ instanceId: string }>({
  name: 'sub/ten/metorial/instance',
  redisUrl: env.service.REDIS_URL
});

export let syncMetorialOrganizationActorQueue = createQueue<{
  organizationActorId: string;
}>({
  name: 'sub/ten/metorial/orgActor',
  redisUrl: env.service.REDIS_URL
});

export let syncMetorialOrganizationMemberQueue = createQueue<{
  organizationMemberId: string;
}>({
  name: 'sub/ten/metorial/orgMember',
  redisUrl: env.service.REDIS_URL
});

export let syncMetorialConsumerQueue = createQueue<{ consumerId: string }>({
  name: 'sub/ten/metorial/consumer',
  redisUrl: env.service.REDIS_URL
});

export let syncMetorialInstanceConsumerQueue = createQueue<{
  instanceConsumerId: string;
}>({
  name: 'sub/ten/metorial/instanceConsumer',
  redisUrl: env.service.REDIS_URL
});

export let syncMetorialConsumerProfileQueue = createQueue<{
  consumerProfileId: string;
}>({
  name: 'sub/ten/metorial/consumerProfile',
  redisUrl: env.service.REDIS_URL
});

export let deleteMetorialConsumerQueue = createQueue<{ consumerId: string }>({
  name: 'sub/ten/metorial/consumer/delete',
  redisUrl: env.service.REDIS_URL
});

export let reconcileMetorialOrganizationQueue = createQueue<{
  organizationId: string;
}>({
  name: 'sub/ten/metorial/reconcile/org',
  redisUrl: env.service.REDIS_URL
});

export let reconcileMetorialConsumerSearchQueue = createQueue<{
  organizationId: string;
  cursor?: string;
}>({
  name: 'sub/ten/metorial/reconcile/consumerSearch',
  redisUrl: env.service.REDIS_URL
});

export let reconcileMetorialIdentitySearchQueue = createQueue<{
  organizationId: string;
  resource: 'actor' | 'member';
  cursor?: string;
}>({
  name: 'sub/ten/metorial/reconcile/identitySearch',
  redisUrl: env.service.REDIS_URL
});

export let reconcileMetorialResourceSearchQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ten/metorial/reconcile/search',
  redisUrl: env.service.REDIS_URL
});

export let syncMetorialOrganizationQueueProcessor = syncMetorialOrganizationQueue.process(
  async data => {
    let organization = await metorialDb.organization.findUniqueOrThrow({
      where: { id: data.organizationId }
    });
    await metorialResourceService.syncOrganization(organization);
  }
);

export let syncMetorialProjectQueueProcessor = syncMetorialProjectQueue.process(async data => {
  let project = await metorialDb.project.findUniqueOrThrow({
    where: { id: data.projectId }
  });
  await metorialResourceService.syncProject(project);
});

export let syncMetorialInstanceQueueProcessor = syncMetorialInstanceQueue.process(
  async data => {
    let instance = await metorialDb.instance.findUniqueOrThrow({
      where: { id: data.instanceId }
    });
    await metorialResourceService.syncInstance(instance);
  }
);

export let syncMetorialOrganizationActorQueueProcessor =
  syncMetorialOrganizationActorQueue.process(async data => {
    let actor = await metorialDb.organizationActor.findUniqueOrThrow({
      where: { id: data.organizationActorId }
    });
    await metorialResourceService.syncOrganizationActor(actor);
  });

export let syncMetorialOrganizationMemberQueueProcessor =
  syncMetorialOrganizationMemberQueue.process(async data => {
    let member = await metorialDb.organizationMember.findUniqueOrThrow({
      where: { id: data.organizationMemberId }
    });
    await metorialResourceService.syncOrganizationMember(member);
  });

export let syncMetorialConsumerQueueProcessor = syncMetorialConsumerQueue.process(
  async data => {
    let consumer = await metorialDb.consumer.findUniqueOrThrow({
      where: { id: data.consumerId }
    });
    await metorialResourceService.syncConsumerGraph(consumer);
  }
);

export let syncMetorialInstanceConsumerQueueProcessor =
  syncMetorialInstanceConsumerQueue.process(async data => {
    let instanceConsumer = await metorialDb.instanceConsumer.findUniqueOrThrow({
      where: { id: data.instanceConsumerId }
    });
    await metorialResourceService.syncInstanceConsumer(instanceConsumer);
  });

export let syncMetorialConsumerProfileQueueProcessor =
  syncMetorialConsumerProfileQueue.process(async data => {
    let consumerProfile = await metorialDb.consumerProfile.findUniqueOrThrow({
      where: { id: data.consumerProfileId }
    });
    await metorialResourceService.syncConsumerProfile(consumerProfile);
  });

export let deleteMetorialConsumerQueueProcessor = deleteMetorialConsumerQueue.process(
  async data => {
    await metorialResourceService.deleteConsumer(data.consumerId);
  }
);

export let reconcileMetorialOrganizationQueueProcessor =
  reconcileMetorialOrganizationQueue.process(async data => {
    await metorialResourceService.reconcileOrganization(data.organizationId);
    await reconcileMetorialIdentitySearchQueue.add(
      { organizationId: data.organizationId, resource: 'actor' },
      { id: `subspace-metorial-actors:${data.organizationId}:start` }
    );
    await reconcileMetorialIdentitySearchQueue.add(
      { organizationId: data.organizationId, resource: 'member' },
      { id: `subspace-metorial-members:${data.organizationId}:start` }
    );
    await reconcileMetorialConsumerSearchQueue.add(
      { organizationId: data.organizationId },
      { id: `subspace-metorial-consumers:${data.organizationId}:start` }
    );
  });

export let reconcileMetorialIdentitySearchQueueProcessor =
  reconcileMetorialIdentitySearchQueue.process(async data => {
    let organization = await metorialDb.organization.findUniqueOrThrow({
      where: { id: data.organizationId },
      select: { oid: true }
    });
    let cursor = data.cursor ? BigInt(data.cursor) : undefined;

    let resources =
      data.resource === 'actor'
        ? await metorialDb.organizationActor.findMany({
            where: {
              organizationOid: organization.oid,
              oid: cursor ? { gt: cursor } : undefined
            },
            orderBy: { oid: 'asc' },
            take: METORIAL_RESOURCE_SYNC_BATCH_SIZE,
            select: { oid: true, id: true }
          })
        : await metorialDb.organizationMember.findMany({
            where: {
              organizationOid: organization.oid,
              oid: cursor ? { gt: cursor } : undefined
            },
            orderBy: { oid: 'asc' },
            take: METORIAL_RESOURCE_SYNC_BATCH_SIZE,
            select: { oid: true, id: true }
          });
    if (resources.length === 0) return;

    if (data.resource === 'actor') {
      await syncMetorialOrganizationActorQueue.addManyWithOps(
        resources.map(actor => ({
          data: { organizationActorId: actor.id },
          opts: { id: `subspace-metorial-actor:${actor.id}` }
        }))
      );
    } else {
      await syncMetorialOrganizationMemberQueue.addManyWithOps(
        resources.map(member => ({
          data: { organizationMemberId: member.id },
          opts: { id: `subspace-metorial-member:${member.id}` }
        }))
      );
    }

    let lastResource = resources[resources.length - 1];
    if (!lastResource) return;
    await reconcileMetorialIdentitySearchQueue.add(
      {
        organizationId: data.organizationId,
        resource: data.resource,
        cursor: lastResource.oid.toString()
      },
      {
        id: `subspace-metorial-${data.resource}s:${data.organizationId}:${lastResource.oid.toString()}`
      }
    );
  });

export let reconcileMetorialConsumerSearchQueueProcessor =
  reconcileMetorialConsumerSearchQueue.process(async data => {
    let organization = await metorialDb.organization.findUniqueOrThrow({
      where: { id: data.organizationId },
      select: { oid: true }
    });
    let consumers = await metorialDb.consumer.findMany({
      where: {
        organizationOid: organization.oid,
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
      },
      orderBy: { oid: 'asc' },
      take: METORIAL_CONSUMER_SYNC_BATCH_SIZE,
      select: { oid: true, id: true }
    });
    if (consumers.length === 0) return;

    await syncMetorialConsumerQueue.addManyWithOps(
      consumers.map(consumer => ({
        data: { consumerId: consumer.id },
        opts: { id: `subspace-metorial-consumer:${consumer.id}` }
      }))
    );

    let lastConsumer = consumers[consumers.length - 1];
    if (!lastConsumer) return;
    await reconcileMetorialConsumerSearchQueue.add(
      {
        organizationId: data.organizationId,
        cursor: lastConsumer.oid.toString()
      },
      {
        id: `subspace-metorial-consumers:${data.organizationId}:${lastConsumer.oid.toString()}`
      }
    );
  });

export let reconcileMetorialResourceCron = createCron(
  {
    name: 'sub/ten/metorial/reconcile/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '*/15 * * * *'
  },
  async () => {
    await reconcileMetorialResourceSearchQueue.add(
      {},
      { id: 'subspace-metorial-resource-search' }
    );
  }
);

export let reconcileMetorialResourceSearchQueueProcessor =
  reconcileMetorialResourceSearchQueue.process(async data => {
    let organizations = await metorialDb.organization.findMany({
      where: {
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
      },
      orderBy: { oid: 'asc' },
      take: METORIAL_RESOURCE_SYNC_BATCH_SIZE,
      select: { oid: true, id: true }
    });
    if (organizations.length === 0) return;

    await reconcileMetorialOrganizationQueue.addManyWithOps(
      organizations.map(organization => ({
        data: { organizationId: organization.id },
        opts: { id: `subspace-metorial-org:${organization.id}` }
      }))
    );

    let lastOrganization = organizations[organizations.length - 1];
    if (!lastOrganization) return;

    await reconcileMetorialResourceSearchQueue.add({
      cursor: lastOrganization.oid.toString()
    });
  });

export let metorialResourceQueues = combineQueueProcessors([
  reconcileMetorialResourceCron,
  reconcileMetorialResourceSearchQueueProcessor,
  reconcileMetorialOrganizationQueueProcessor,
  reconcileMetorialIdentitySearchQueueProcessor,
  reconcileMetorialConsumerSearchQueueProcessor,
  syncMetorialOrganizationQueueProcessor,
  syncMetorialProjectQueueProcessor,
  syncMetorialInstanceQueueProcessor,
  syncMetorialOrganizationActorQueueProcessor,
  syncMetorialOrganizationMemberQueueProcessor,
  syncMetorialConsumerQueueProcessor,
  syncMetorialInstanceConsumerQueueProcessor,
  syncMetorialConsumerProfileQueueProcessor,
  deleteMetorialConsumerQueueProcessor
]);
