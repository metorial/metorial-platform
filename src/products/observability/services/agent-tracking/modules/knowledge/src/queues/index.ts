import { combineQueueProcessors } from '@lowerdeck/queue';
import { knowledgeImpactProcessor } from './knowledgeImpact';
import { knowledgeSyncProcessor } from './knowledgeSync';

export let knowledgeQueueProcessor = combineQueueProcessors([
  knowledgeImpactProcessor,
  knowledgeSyncProcessor
]);
