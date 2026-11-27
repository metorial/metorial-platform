import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexAgentClientQueueProcessor } from './agentClient';

export let searchQueues = combineQueueProcessors([indexAgentClientQueueProcessor]);
