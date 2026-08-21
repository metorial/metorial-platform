import { combineQueueProcessors } from '@lowerdeck/queue';
import './listener';
import { deleteQueues } from './queues/delete';
import { lifecycleQueues } from './queues/lifecycle';
import { searchQueues } from './queues/search';

export let chatQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  deleteQueues
]);
