import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import { getSkillSlug } from '../lib/skillSlug';

export let RECONCILE_SKILL_SLUGS_BATCH_SIZE = 500;

export let reconcileSkillSlugsCron = createCron(
  {
    name: 'cargo/skill/slug/reconcile/cron',
    cron: '0 0 * * *'
  },
  async () => {
    await reconcileSkillSlugsManyQueue.add({});
  }
);

export let reconcileSkillSlugsManyQueue = createQueue<{ cursor?: string }>({
  name: 'cargo/skill/slug/reconcile/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileSkillSlugsManyQueueProcessor = reconcileSkillSlugsManyQueue.process(
  async data => {
    let skills = await db.skill.findMany({
      where: {
        OR: [{ slug: null }, { slug: '' }],
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RECONCILE_SKILL_SLUGS_BATCH_SIZE,
      select: { id: true }
    });

    if (skills.length === 0) return;

    await reconcileSkillSlugsSingleQueue.addManyWithOps(
      skills.map(skill => ({
        data: { skillId: skill.id },
        opts: { id: skill.id }
      }))
    );

    if (skills.length === RECONCILE_SKILL_SLUGS_BATCH_SIZE) {
      await reconcileSkillSlugsManyQueue.add(
        { cursor: skills[skills.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  }
);

export let reconcileSkillSlugsSingleQueue = createQueue<{ skillId: string }>({
  name: 'cargo/skill/slug/reconcile/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let reconcileSkillSlugsSingleQueueProcessor = reconcileSkillSlugsSingleQueue.process(
  async data => {
    let skill = await db.skill.findUnique({
      where: { id: data.skillId },
      select: { id: true, name: true, slug: true }
    });

    if (!skill || skill.slug) return;

    await db.skill.updateMany({
      where: {
        id: skill.id,
        OR: [{ slug: null }, { slug: '' }]
      },
      data: { slug: getSkillSlug(skill.name) }
    });
  }
);

export let reconcileSkillSlugsProcessors = combineQueueProcessors([
  reconcileSkillSlugsCron,
  reconcileSkillSlugsManyQueueProcessor,
  reconcileSkillSlugsSingleQueueProcessor
]);
