import { combineQueueProcessors } from '@metorial/queue';
import { relayEmailQueueProcessor } from './relay';

export * from './sendWithTemplate';
export * from './templates';

export let emailQueueProcessor = combineQueueProcessors([relayEmailQueueProcessor]);
