import { combineQueueProcessors } from '@lowerdeck/queue';
import { registerCallbackEventDelegate } from '@metorial-subspace/module-callback';
import { chatAdapterIdentifier } from '../../internal/chatEvent';
import { chatEventIngestQueueProcessor, enqueueChatEventIngest } from './ingest';
import {
  chatEventPayloadFlushCron,
  chatEventPayloadFlushManyQueueProcessor,
  chatEventPayloadFlushSingleQueueProcessor
} from './payloadFlush';

export * from './ingest';
export * from './payloadFlush';

registerCallbackEventDelegate(chatAdapterIdentifier, enqueueChatEventIngest);

export let eventQueues = combineQueueProcessors([
  chatEventIngestQueueProcessor,
  chatEventPayloadFlushManyQueueProcessor,
  chatEventPayloadFlushSingleQueueProcessor,
  chatEventPayloadFlushCron
]);

export let eventSubspaceQueues = combineQueueProcessors([chatEventIngestQueueProcessor]);

export let eventFederationQueues = combineQueueProcessors([
  chatEventPayloadFlushManyQueueProcessor,
  chatEventPayloadFlushSingleQueueProcessor,
  chatEventPayloadFlushCron
]);
