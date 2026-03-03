import { combineQueueProcessors } from '@metorial/queue';
import { magicQueues } from './queues';

export * from './services';
export * from './queues';

export let magicQueueProcessor = combineQueueProcessors([magicQueues]);
