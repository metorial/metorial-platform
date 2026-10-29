import { combineQueueProcessors } from '@metorial/queue';
import { lifecycleQueues } from './lifecycle';
import {
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor,
  reconcileSkillProviderLinksForProviderQueueProcessor,
  reconcileSkillProviderLinksQueueProcessor
} from './reconcileSkillProviderLinks';
import { reconcileSkillSlugsProcessors } from './reconcileSkillSlugs';
import { searchQueues } from './search';
import { skillStoreResourceBackfillProcessors } from './storeResourceBackfill';

export let skillQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  reconcileSkillProviderLinksQueueProcessor,
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor,
  reconcileSkillProviderLinksForProviderQueueProcessor,
  reconcileSkillSlugsProcessors,
  skillStoreResourceBackfillProcessors
]);

export * from './lifecycle';
export * from './reconcileSkillProviderLinks';
export * from './reconcileSkillSlugs';
export * from './search';
export * from './storeResourceBackfill';
