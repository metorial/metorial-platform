import { addAfterTransactionHook } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { indexSkillTemplateQueue } from '../search/skillTemplate';
import { getLifecycleJobId, type LifecycleEvent } from './_ids';

let skillTemplateLifecycleQueue = createQueue<{
  skillTemplateId: string;
  event: LifecycleEvent;
}>({
  name: 'cargo/skill/lifecycle/skillTemplate',
  workerOpts: { concurrency: 10 }
});

export let enqueueSkillTemplateLifecycle = async (d: {
  skillTemplateId: string;
  event: LifecycleEvent;
}) => {
  await addAfterTransactionHook(async () => {
    await skillTemplateLifecycleQueue.add(d, {
      id: getLifecycleJobId('skillTemplate', d.skillTemplateId)
    });
  });
};

export let skillTemplateLifecycleQueueProcessor = skillTemplateLifecycleQueue.process(
  async data => {
    await indexSkillTemplateQueue.add({ skillTemplateId: data.skillTemplateId });
  }
);
