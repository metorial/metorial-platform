import { combineQueueProcessors } from '@metorial/queue';
import { magicLifecycleQueueProcessor } from './lifecycle';
import { reconcileProviderTemplatesProcessors } from './reconcileProviderTemplates';
import { magicSearchQueueProcessor } from './search';

export * from './lifecycle';
export * from './reconcileProviderTemplates';
export * from './search';

export let magicQueues = combineQueueProcessors([
  magicLifecycleQueueProcessor,
  reconcileProviderTemplatesProcessors,
  magicSearchQueueProcessor
]);
