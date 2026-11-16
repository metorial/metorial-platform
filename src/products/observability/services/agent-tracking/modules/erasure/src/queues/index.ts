import { combineQueueProcessors } from '@lowerdeck/queue';
import { eraseUserProcessor } from './eraseUser';

export let erasureQueueProcessor = combineQueueProcessors([eraseUserProcessor]);
