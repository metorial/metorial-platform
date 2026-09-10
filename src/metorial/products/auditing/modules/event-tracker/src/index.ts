import { combineQueueProcessors } from '@metorial/queue';
import { systemEventIngestQueueProcessor } from './queues/ingestEvent';
import { eventPayloadFlushProcessors } from './queues/payloadFlush';

export * from './lib/resolvePayload';
export * from './queues/ingestEvent';
export * from './services';

export let eventTrackerQueueProcessor = combineQueueProcessors([
  systemEventIngestQueueProcessor,
  eventPayloadFlushProcessors
]);
