import { createCron } from '@lowerdeck/cron';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@lowerdeck/queue';
import { db } from '../db';
import { env } from '../env';
import { mergeSuggestionService } from '../services/mergeSuggestion';

let pageSize = 500;

export let mergeSuggestionsCron = createCron(
  {
    name: 'gs/users/merge-suggestions/cron',
    cron: '0 3 * * *',
    redisUrl: env.service.REDIS_URL,
    startupJitterMs: 60_000
  },
  async () => {
    await mergeSuggestionsManyQueue.add({});
  }
);

export let mergeSuggestionsManyQueue = createQueue<{ cursor?: string }>({
  name: 'gs/users/merge-suggestions/many',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let mergeSuggestionsManyProcessor = mergeSuggestionsManyQueue.process(async data => {
  let organizations = await db.organization.findMany({
    where: { archivedAt: null, id: data.cursor ? { gt: data.cursor } : undefined },
    orderBy: { id: 'asc' },
    take: pageSize,
    select: { id: true }
  });

  if (!organizations.length) return;

  await mergeSuggestionsSingleQueue.addManyWithOps(
    organizations.map(organization => ({
      data: { organizationId: organization.id },
      opts: { id: organization.id }
    }))
  );

  if (organizations.length == pageSize) {
    await mergeSuggestionsManyQueue.add(
      { cursor: organizations[organizations.length - 1]!.id },
      dailyPacedDelay()
    );
  }
});

export let mergeSuggestionsSingleQueue = createQueue<{ organizationId: string }>({
  name: 'gs/users/merge-suggestions/single',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let mergeSuggestionsSingleProcessor = mergeSuggestionsSingleQueue.process(
  async data => {
    let organization = await db.organization.findUnique({
      where: { id: data.organizationId }
    });
    if (!organization || organization.archivedAt) return;

    await mergeSuggestionService.refreshMergeSuggestions({ organization });
  }
);

export let mergeSuggestionsProcessor = combineQueueProcessors([
  mergeSuggestionsCron,
  mergeSuggestionsManyProcessor,
  mergeSuggestionsSingleProcessor
]);
