import { combineQueueProcessors } from '@lowerdeck/queue';
import { propagateSkillDirtyQueueProcessor, skillLifecycleQueueProcessor } from './skill';
import {
  propagateSkillConfigurationDirtyQueueProcessor,
  skillConfigurationLifecycleQueueProcessor
} from './skillConfiguration';
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

export * from './skill';
export * from './skillConfiguration';
export * from './skillMarketplace';
export * from './skillMarketplacePlugin';
export * from './skillPlugin';
export * from './skillPluginSkill';

export let lifecycleQueues = combineQueueProcessors([
  skillLifecycleQueueProcessor,
  skillPluginLifecycleQueueProcessor,
  skillPluginSkillLifecycleQueueProcessor,
  skillMarketplaceLifecycleQueueProcessor,
  skillMarketplacePluginLifecycleQueueProcessor,
  skillConfigurationLifecycleQueueProcessor,
  propagateSkillDirtyQueueProcessor,
  propagateSkillPluginDirtyQueueProcessor,
  propagateSkillPluginSkillDirtyQueueProcessor,
  propagateSkillMarketplaceDirtyQueueProcessor,
  propagateSkillMarketplacePluginDirtyQueueProcessor,
  propagateSkillConfigurationDirtyQueueProcessor
]);
