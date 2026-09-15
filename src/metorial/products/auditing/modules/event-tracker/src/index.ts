import { combineQueueProcessors } from '@metorial/queue';
import { systemEventIngestQueueProcessor } from './queues/ingestEvent';
import { eventPayloadFlushProcessors } from './queues/payloadFlush';
import { systemEventCleanupProcessors } from './queues/systemEventCleanup';

export * from './lib/resolvePayload';
export * from './queues/ingestEvent';
export * from './services';

export let eventTrackerQueueProcessor = combineQueueProcessors([
  systemEventIngestQueueProcessor,
  eventPayloadFlushProcessors,
  systemEventCleanupProcessors
]);
