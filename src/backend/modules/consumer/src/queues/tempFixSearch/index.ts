import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { indexConsumerSearchQueue } from '../search/consumer';
import { indexConsumerAccessRequestSearchQueue } from '../search/consumerAccessRequest';
import { indexConsumerGroupSearchQueue } from '../search/consumerGroup';
import { indexProviderTemplateSearchQueue } from '../search/providerTemplate';

type TempFixSearchResourceType =
  | 'consumer'
  | 'consumerGroup'
  | 'consumerAccessRequest'
  | 'providerTemplate';

let BATCH_SIZE = 100;

let tempFixSearchResourceTypes: TempFixSearchResourceType[] = [
  'consumer',
  'consumerGroup',
  'consumerAccessRequest',
  'providerTemplate'
];

let startIndexingTempFixSearch = async () => {
  await tempFixSearchManyQueue.addMany(
    tempFixSearchResourceTypes.map(resourceType => ({
      resourceType
    }))
  );
};

startIndexingTempFixSearch();

export let tempFixSearchCron = createCron(
  {
    name: 'cons/search/temp-fix/cron',
    cron: '0 * * * *'
  },
  async () => {
    startIndexingTempFixSearch();
  }
);

export let tempFixSearchManyQueue = createQueue<{
  resourceType: TempFixSearchResourceType;
  cursor?: string;
}>({
  name: 'cons/search/temp-fix/many'
});

export let tempFixSearchManyQueueProcessor = tempFixSearchManyQueue.process(async data => {
  let items =
    data.resourceType === 'consumer'
      ? await db.instanceConsumer.findMany({
          where: {
            id: data.cursor ? { gt: data.cursor } : undefined
          },
          select: { id: true },
          take: BATCH_SIZE,
          orderBy: { id: 'asc' }
        })
      : data.resourceType === 'consumerGroup'
        ? await db.consumerGroup.findMany({
            where: {
              id: data.cursor ? { gt: data.cursor } : undefined
            },
            select: { id: true },
            take: BATCH_SIZE,
            orderBy: { id: 'asc' }
          })
        : data.resourceType === 'consumerAccessRequest'
          ? await db.consumerAccessRequest.findMany({
              where: {
                id: data.cursor ? { gt: data.cursor } : undefined
              },
              select: { id: true },
              take: BATCH_SIZE,
              orderBy: { id: 'asc' }
            })
          : await db.providerTemplate.findMany({
              where: {
                id: data.cursor ? { gt: data.cursor } : undefined
              },
              select: { id: true },
              take: BATCH_SIZE,
              orderBy: { id: 'asc' }
            });

  if (items.length === 0) return;

  await tempFixSearchSingleQueue.addMany(
    items.map(item => ({
      resourceType: data.resourceType,
      resourceId: item.id
    }))
  );

  await tempFixSearchManyQueue.add({
    resourceType: data.resourceType,
    cursor: items[items.length - 1]!.id
  });
});

export let tempFixSearchSingleQueue = createQueue<{
  resourceType: TempFixSearchResourceType;
  resourceId: string;
}>({
  name: 'cons/search/temp-fix/single',
  workerOpts: {
    concurrency: 5
  }
});

export let tempFixSearchSingleQueueProcessor = tempFixSearchSingleQueue.process(async data => {
  if (data.resourceType === 'consumer') {
    await indexConsumerSearchQueue.add({
      instanceConsumerId: data.resourceId
    });
    return;
  }

  if (data.resourceType === 'consumerGroup') {
    await indexConsumerGroupSearchQueue.add({
      consumerGroupId: data.resourceId
    });
    return;
  }

  if (data.resourceType === 'consumerAccessRequest') {
    await indexConsumerAccessRequestSearchQueue.add({
      consumerAccessRequestId: data.resourceId
    });
    return;
  }

  await indexProviderTemplateSearchQueue.add({
    providerTemplateId: data.resourceId
  });
});

export let tempFixSearchProcessors = combineQueueProcessors([
  tempFixSearchCron,
  tempFixSearchManyQueueProcessor,
  tempFixSearchSingleQueueProcessor
]);
