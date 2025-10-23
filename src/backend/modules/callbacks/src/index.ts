import { combineQueueProcessors } from '@metorial/queue';
import { cleanupCron } from './cron/cleanup';
import {
  pollingCron,
  pollingManyQueueProcessor,
  pollingSingleQueueProcessor
} from './cron/polling';
import { installCallbackQueueProcessor } from './queue/installCallback';
import { processEventQueueProcessor } from './queue/processEvent';
import { registerCallbackQueueProcessor } from './queue/registerCallback';

export * from './services';

export let callbacksQueueProcessor = combineQueueProcessors([
  pollingSingleQueueProcessor,
  pollingManyQueueProcessor,
  pollingCron,

  cleanupCron,

  processEventQueueProcessor,
  installCallbackQueueProcessor,
  registerCallbackQueueProcessor
]);
