import { combineQueueProcessors } from '@mtsrc/queue';
import { indexAgentClientQueueProcessor } from './agentClient';

export let searchQueues = combineQueueProcessors([indexAgentClientQueueProcessor]);
