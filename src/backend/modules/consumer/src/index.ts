import { combineQueueProcessors } from '@metorial/queue';
import { authCodeQueueProcessor } from './queues/authCode';

export * from './services';

export let consumerQueueProcessor = combineQueueProcessors([authCodeQueueProcessor]);
