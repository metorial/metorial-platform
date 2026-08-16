import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { indexSkillGroupQueue } from '@metorial/module-skill-groups';
import { indexSkillTemplateQueue } from '@metorial/module-skill-templates';
import { indexSkillQueue } from './skill';

let batchSize = 100;
type SkillResourceType = 'skill' | 'skillGroup' | 'skillTemplate';

export let reindexSkillResourcesCron = createCron(
  {
    name: 'cargo/skill/search/reindex/cron',
    cron: '0 * * * *'
  },
  async () => {
    await reindexSkillResourcesManyQueue.addMany([
      { resourceType: 'skill' },
      { resourceType: 'skillGroup' },
      { resourceType: 'skillTemplate' }
    ]);
  }
);

export let reindexSkillResourcesManyQueue = createQueue<{
  resourceType: SkillResourceType;
  cursor?: string;
}>({
  name: 'cargo/skill/search/reindex/many',
  workerOpts: { concurrency: 1 }
});

export let reindexSkillResourcesSingleQueue = createQueue<{
  resourceType: SkillResourceType;
  resourceId: string;
}>({
  name: 'cargo/skill/search/reindex/single',
  workerOpts: { concurrency: 10 }
});

export let reindexSkillResourcesManyQueueProcessor = reindexSkillResourcesManyQueue.process(
  async data => {
    let resources = await listSkillResources({
      resourceType: data.resourceType,
      cursor: data.cursor
    });
    if (resources.length === 0) return;

    await reindexSkillResourcesSingleQueue.addMany(
      resources.map(resource => ({
        resourceType: data.resourceType,
        resourceId: resource.id
      }))
    );

    if (resources.length === batchSize) {
      await reindexSkillResourcesManyQueue.add({
        resourceType: data.resourceType,
        cursor: resources[resources.length - 1]!.id
      });
    }
  }
);

export let reindexSkillResourcesSingleQueueProcessor =
  reindexSkillResourcesSingleQueue.process(async data => {
    if (data.resourceType === 'skill') {
      await indexSkillQueue.add({ skillId: data.resourceId });
      return;
    }
    if (data.resourceType === 'skillGroup') {
      await indexSkillGroupQueue.add({ skillGroupId: data.resourceId });
      return;
    }
    await indexSkillTemplateQueue.add({ skillTemplateId: data.resourceId });
  });

let listSkillResources = async (d: { resourceType: SkillResourceType; cursor?: string }) => {
  let args = {
    where: {
      id: d.cursor ? { gt: d.cursor } : undefined
    },
    orderBy: { id: 'asc' as const },
    select: { id: true },
    take: batchSize
  };

  if (d.resourceType === 'skill') return await db.skill.findMany(args);
  if (d.resourceType === 'skillGroup') return await db.skillGroup.findMany(args);
  return await db.skillTemplate.findMany(args);
};

export let reindexSkillResourcesQueueProcessor = combineQueueProcessors([
  reindexSkillResourcesCron,
  reindexSkillResourcesManyQueueProcessor,
  reindexSkillResourcesSingleQueueProcessor
]);
