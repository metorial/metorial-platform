import { createQueue } from '@lowerdeck/queue';
import { env } from '@metorial-cargo/db';
import { managedSkillPluginService } from '../../services/managedSkillPlugin';
import { getLifecycleJobId, type LifecycleEvent } from './_ids';

let managedSkillPluginLifecycleQueue = createQueue<{
  skillId: string;
  event: LifecycleEvent;
}>({
  redisUrl: env.service.REDIS_URL,
  name: 'cargo/skill/lifecycle/managedPlugin',
  workerOpts: {
    concurrency: 10
  }
});

export let enqueueManagedSkillPluginLifecycle = async (d: {
  skillId: string;
  event: LifecycleEvent;
}) => {
  await managedSkillPluginLifecycleQueue.add(d, {
    id: getLifecycleJobId('managedSkillPlugin', d.skillId)
  });
};

export let managedSkillPluginLifecycleQueueProcessor = managedSkillPluginLifecycleQueue.process(
  async data => {
    await managedSkillPluginService.syncManagedSkillPluginForSkill(data);
  }
);
