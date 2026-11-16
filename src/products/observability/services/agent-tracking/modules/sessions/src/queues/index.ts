import { combineQueueProcessors } from '@lowerdeck/queue';
import { reattributeProcessor } from './reattribute';
import { sessionReconcileProcessor } from './sessionReconcile';
import { sessionSettleProcessor } from './sessionSettle';
import { sessionStateProcessor } from './sessionState';
import { sessionlessSlicesProcessor } from './sessionlessSlices';

export let sessionsQueueProcessor = combineQueueProcessors([
  reattributeProcessor,
  sessionReconcileProcessor,
  sessionSettleProcessor,
  sessionStateProcessor,
  sessionlessSlicesProcessor
]);
