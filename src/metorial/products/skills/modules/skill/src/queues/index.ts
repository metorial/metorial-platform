import { combineQueueProcessors } from '@metorial/queue';
import { skillImportAcquireQueueProcessor } from './import/acquire';
import { skillImportDiscoverQueueProcessor } from './import/discover';
import { skillImportFinishQueueProcessor } from './import/finish';
import { skillImportItemQueueProcessor } from './import/item';
import { skillImportRecoveryCron } from './import/recovery';
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
  skillImportAcquireQueueProcessor,
  skillImportDiscoverQueueProcessor,
  skillImportItemQueueProcessor,
  skillImportFinishQueueProcessor,
  skillImportRecoveryCron,
  reconcileSkillProviderLinksQueueProcessor,
  reconcileSkillProviderLinksForIntegrationProviderQueueProcessor,
  reconcileSkillProviderLinksForProviderQueueProcessor
]);

export * from './import/acquire';
export * from './lifecycle';
export * from './reconcileSkillProviderLinks';
export * from './search';
