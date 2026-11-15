import { runQueueProcessors } from '@lowerdeck/queue';
import { onKnowledgeWorkerStart } from '@mtsrc/agent-tracking-module-knowledge';
import { onRebuildWorkerStart } from '@mtsrc/agent-tracking-module-rebuild';
import { agentTrackingQueues } from './queues';

await runQueueProcessors([agentTrackingQueues]);

await onRebuildWorkerStart();

await onKnowledgeWorkerStart();
