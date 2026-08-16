import { combineQueueProcessors } from '@metorial/queue';
import { lifecycleQueues } from './lifecycle';
import {
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor,
  reconcileSkillProviderLinksForProviderQueueProcessor,
  reconcileSkillProviderLinksQueueProcessor
} from './reconcileSkillProviderLinks';
import { searchQueues } from './search';

export let skillQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  reconcileSkillProviderLinksQueueProcessor,
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor,
  reconcileSkillProviderLinksForProviderQueueProcessor
]);

export * from './lifecycle';
export * from './reconcileSkillProviderLinks';
export * from './search';
