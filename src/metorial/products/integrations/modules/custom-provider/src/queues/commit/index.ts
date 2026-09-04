import { combineQueueProcessors } from '@lowerdeck/queue';
import { commitApplyQueueProcessor } from './apply';

export let commitQueues = combineQueueProcessors([commitApplyQueueProcessor]);
