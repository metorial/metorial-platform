import { db } from '@metorial/db';
import { indexSkillGroupQueue } from '@metorial/module-skill-groups';
import { indexSkillTemplateQueue } from '@metorial/module-skill-templates';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { indexSkillQueue } from './skill';

let batchSize = 500;
type SkillResourceType = 'skill' | 'skillGroup' | 'skillTemplate';

export let startFullSkillResourceReindex = async () => {
  await reindexSkillResourcesManyQueue.addMany([
    { resourceType: 'skill' },
    { resourceType: 'skillGroup' },
    { resourceType: 'skillTemplate' }
  ]);
};

export let reindexSkillResourcesManyQueue = createQueue<{
  resourceType: SkillResourceType;
  cursor?: string;
}>({
  name: 'cargo/skill/search/reindex/many',
  workerOpts: { concurrency: 1 }
});

export let reindexSkillResourcesManyQueueProcessor = reindexSkillResourcesManyQueue.process(
  async data => {
    let resources = await listSkillResources({
      resourceType: data.resourceType,
      cursor: data.cursor
    });
    if (resources.length === 0) return;

    if (data.resourceType === 'skill') {
      await indexSkillQueue.addMany(resources.map(resource => ({ skillId: resource.id })));
    } else if (data.resourceType === 'skillGroup') {
      await indexSkillGroupQueue.addMany(
        resources.map(resource => ({ skillGroupId: resource.id }))
      );
    } else {
      await indexSkillTemplateQueue.addMany(
        resources.map(resource => ({ skillTemplateId: resource.id }))
      );
    }

    if (resources.length === batchSize) {
      await reindexSkillResourcesManyQueue.add(
        {
          resourceType: data.resourceType,
          cursor: resources[resources.length - 1]!.id
        },
        hourlyPacedDelay()
      );
    }
  }
);

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
  reindexSkillResourcesManyQueueProcessor
]);
