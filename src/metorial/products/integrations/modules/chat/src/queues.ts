import { combineQueueProcessors } from '@lowerdeck/queue';
import './listener';
import { attachmentQueues } from './queues/attachment';
import { deleteQueues } from './queues/delete';
import { lifecycleQueues } from './queues/lifecycle';
import { searchQueues } from './queues/search';
import { syncQueues } from './queues/sync';

export let chatQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  deleteQueues,
  syncQueues,
  attachmentQueues
]);
