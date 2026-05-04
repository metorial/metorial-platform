import { combineQueueProcessors } from '@metorial/queue';
import { magicLifecycleQueueProcessor } from './lifecycle';
import { reconcileMagicMcpServerBackingProcessors } from './reconcileMagicMcpServerBacking';
import { magicSearchQueueProcessor } from './search';

export * from './lifecycle';
export * from './reconcileMagicMcpServerBacking';
export * from './search';

export let magicQueues = combineQueueProcessors([
  magicLifecycleQueueProcessor,
  reconcileMagicMcpServerBackingProcessors,
  magicSearchQueueProcessor
]);
