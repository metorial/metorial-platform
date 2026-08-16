import { addAfterTransactionHook, db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { indexSkillGroupQueue } from '../search/skillGroup';
import { indexSkillQueue } from '../search/skill';
import { getLifecycleJobId, type LifecycleEvent } from './_ids';

let skillGroupLifecycleQueue = createQueue<{
  skillGroupId: string;
  event: LifecycleEvent;
}>({
  name: 'cargo/skill/lifecycle/skillGroup',
  workerOpts: { concurrency: 10 }
});

export let enqueueSkillGroupLifecycle = async (d: {
  skillGroupId: string;
  event: LifecycleEvent;
}) => {
  await addAfterTransactionHook(async () => {
    await skillGroupLifecycleQueue.add(d, {
      id: getLifecycleJobId('skillGroup', d.skillGroupId)
    });
  });
};

export let skillGroupLifecycleQueueProcessor = skillGroupLifecycleQueue.process(async data => {
  let group = await db.skillGroup.findUnique({
    where: { id: data.skillGroupId },
    select: {
      id: true,
      items: {
        where: { status: 'active' },
        select: { skill: { select: { id: true } } }
      }
    }
  });
  if (!group) return;

  // Search indexing is attached here by the search queue implementation.
  await indexSkillGroupQueue.add({ skillGroupId: group.id });
  await indexSkillQueue.addMany(group.items.map(item => ({ skillId: item.skill.id })));
});
