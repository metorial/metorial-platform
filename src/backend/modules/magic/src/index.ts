import { combineQueueProcessors } from '@metorial/queue';
import { magicQueues } from './queues';

export * from './lib/ensureSession';
export * from './lib/magicMcpTarget';
export * from './queues';
export * from './services';

export let magicQueueProcessor = combineQueueProcessors([magicQueues]);
