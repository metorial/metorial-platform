import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexPublicMcpServerQueueProcessor } from './publicMcpServer';

export let searchQueues = combineQueueProcessors([indexPublicMcpServerQueueProcessor]);
