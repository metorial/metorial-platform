import { combineQueueProcessors } from '@metorial/queue';
import { magicLifecycleQueueProcessor } from './lifecycle';
import { magicSearchQueueProcessor } from './search';

export * from './lifecycle';
export * from './search';

export let magicQueues = combineQueueProcessors([
  magicLifecycleQueueProcessor,
  magicSearchQueueProcessor
]);
