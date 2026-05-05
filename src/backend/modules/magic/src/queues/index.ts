import { combineQueueProcessors } from '@metorial/queue';
import { magicLifecycleQueueProcessor } from './lifecycle';
import { reconcileMagicMcpEndpointBackingProcessors } from './reconcileMagicMcpEndpointBacking';
import { reconcileMagicMcpServerBackingProcessors } from './reconcileMagicMcpServerBacking';
import { magicSearchQueueProcessor } from './search';

export * from './lifecycle';
export * from './reconcileMagicMcpEndpointBacking';
export * from './reconcileMagicMcpServerBacking';
export * from './search';

export let magicQueues = combineQueueProcessors([
  magicLifecycleQueueProcessor,
  reconcileMagicMcpEndpointBackingProcessors,
  reconcileMagicMcpServerBackingProcessors,
  magicSearchQueueProcessor
]);
