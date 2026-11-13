import './listeners/entity';
import './listeners/scope';
import { combineQueueProcessors } from '@metorial/queue';
import { agentTelemetryQueues } from './queues';

export * from './services';

export let agentTelemetryQueueProcessor = combineQueueProcessors([agentTelemetryQueues]);
