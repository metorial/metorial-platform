import { combineQueueProcessors } from '@metorial/queue';
import { magicLifecycleQueueProcessor } from './lifecycle';
import { reconcileMagicMcpBackingProcessors } from './reconcileMagicMcpBacking';
import { reconcileProviderTemplatesProcessors } from './reconcileProviderTemplates';
import { magicSearchQueueProcessor } from './search';

export * from './lifecycle';
export * from './reconcileMagicMcpBacking';
export * from './reconcileProviderTemplates';
export * from './search';

export let magicQueues = combineQueueProcessors([
  magicLifecycleQueueProcessor,
  reconcileProviderTemplatesProcessors,
  reconcileMagicMcpBackingProcessors,
  magicSearchQueueProcessor
]);
