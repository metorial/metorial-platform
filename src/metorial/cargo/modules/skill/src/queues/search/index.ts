import { combineQueueProcessors } from '@metorial/queue';
import { indexSkillQueueProcessor } from './skill';
import { indexSkillGroupQueueProcessor } from './skillGroup';
import { indexSkillMarketplaceQueueProcessor } from './skillMarketplace';
import { indexSkillPluginQueueProcessor } from './skillPlugin';
import { indexSkillTemplateQueueProcessor } from './skillTemplate';
import { reindexSkillResourcesQueueProcessor } from './reindex';

export * from './skill';
export * from './skillGroup';
export * from './skillMarketplace';
export * from './skillPlugin';
export * from './skillTemplate';
export * from './reindex';

export let searchQueues = combineQueueProcessors([
  indexSkillQueueProcessor,
  indexSkillGroupQueueProcessor,
  indexSkillTemplateQueueProcessor,
  reindexSkillResourcesQueueProcessor,
  indexSkillPluginQueueProcessor,
  indexSkillMarketplaceQueueProcessor
]);
