import { combineQueueProcessors } from '@metorial/queue';
import { managedSkillPluginLifecycleQueueProcessor } from './managedSkillPlugin';
import {
  propagateSkillMarketplaceDirtyQueueProcessor,
  skillMarketplaceLifecycleQueueProcessor
} from './skillMarketplace';
import {
  propagateSkillMarketplacePluginDirtyQueueProcessor,
  skillMarketplacePluginLifecycleQueueProcessor
} from './skillMarketplacePlugin';
import {
  propagateSkillPluginDirtyQueueProcessor,
  skillPluginLifecycleQueueProcessor
} from './skillPlugin';
import {
  propagateSkillPluginSkillDirtyQueueProcessor,
  skillPluginSkillLifecycleQueueProcessor
} from './skillPluginSkill';

export * from './managedSkillPlugin';
export * from './skillMarketplace';
export * from './skillMarketplacePlugin';
export * from './skillPlugin';
export * from './skillPluginSkill';

export let lifecycleQueues = combineQueueProcessors([
  managedSkillPluginLifecycleQueueProcessor,
  skillPluginLifecycleQueueProcessor,
  skillPluginSkillLifecycleQueueProcessor,
  skillMarketplaceLifecycleQueueProcessor,
  skillMarketplacePluginLifecycleQueueProcessor,
  propagateSkillPluginDirtyQueueProcessor,
  propagateSkillPluginSkillDirtyQueueProcessor,
  propagateSkillMarketplaceDirtyQueueProcessor,
  propagateSkillMarketplacePluginDirtyQueueProcessor
]);
