import { combineQueueProcessors } from '@lowerdeck/queue';
import { exportReconcileProcessors } from '../cron/exportReconcile';
import { exportChunkProcessor } from './exportChunk';

export let queryQueueProcessor = combineQueueProcessors([
  exportChunkProcessor,
  exportReconcileProcessors
]);
