import { combineQueueProcessors } from '@lowerdeck/queue';
import { publicMcpQueueProcessors } from './queues/index';

export let publicMcpSubspaceQueueProcessor = combineQueueProcessors([
  publicMcpQueueProcessors
]);
