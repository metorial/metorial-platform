import { combineQueueProcessors } from '@lowerdeck/queue';
import { classificationQueueProcessor } from '@mtsrc/agent-tracking-module-classification';
import { entitiesQueueProcessor } from '@mtsrc/agent-tracking-module-entities';
import { erasureQueueProcessor } from '@mtsrc/agent-tracking-module-erasure';
import { knowledgeQueueProcessor } from '@mtsrc/agent-tracking-module-knowledge';
import { queryQueueProcessor } from '@mtsrc/agent-tracking-module-query';
import { rebuildQueueProcessor } from '@mtsrc/agent-tracking-module-rebuild';
import { recordsQueueProcessor } from '@mtsrc/agent-tracking-module-records';
import { sessionsQueueProcessor } from '@mtsrc/agent-tracking-module-sessions';

export let agentTrackingQueues = combineQueueProcessors([
  recordsQueueProcessor,
  entitiesQueueProcessor,
  classificationQueueProcessor,
  sessionsQueueProcessor,
  rebuildQueueProcessor,
  erasureQueueProcessor,
  knowledgeQueueProcessor,
  queryQueueProcessor
]);
