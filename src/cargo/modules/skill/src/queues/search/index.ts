import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexSkillMarketplaceQueueProcessor } from './skillMarketplace';
import { indexSkillPluginQueueProcessor } from './skillPlugin';

export * from './skillMarketplace';
export * from './skillPlugin';

export let searchQueues = combineQueueProcessors([
  indexSkillPluginQueueProcessor,
  indexSkillMarketplaceQueueProcessor
]);
