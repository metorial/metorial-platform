import { Fabric } from '@metorial/fabric';
import { enqueueSkillPluginLifecycle } from '../queues/lifecycle/skillPlugin';

Fabric.listen('skill.plugin.slug.reassigned:after', async ({ skillPlugin }) => {
  await enqueueSkillPluginLifecycle({ skillPluginId: skillPlugin.id, event: 'updated' });
});
