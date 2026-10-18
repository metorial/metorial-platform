import { combineQueueProcessors } from '@lowerdeck/queue';
import './listener';
import { attachmentFederationQueues, attachmentSubspaceQueues } from './queues/attachment';
import { deleteQueues } from './queues/delete';
import { eventFederationQueues, eventSubspaceQueues } from './queues/event';
import { lifecycleFederationQueues, lifecycleSubspaceQueues } from './queues/lifecycle';
import { searchQueues } from './queues/search';
import { syncFederationQueues, syncSubspaceQueues } from './queues/sync';

export let chatSubspaceQueueProcessor = combineQueueProcessors([
  lifecycleSubspaceQueues,
  syncSubspaceQueues,
  attachmentSubspaceQueues,
  eventSubspaceQueues
]);

export let chatFederationQueueProcessor = combineQueueProcessors([
  lifecycleFederationQueues,
  searchQueues,
  deleteQueues,
  syncFederationQueues,
  attachmentFederationQueues,
  eventFederationQueues
]);

export let chatQueueProcessor = combineQueueProcessors([
  chatSubspaceQueueProcessor,
  chatFederationQueueProcessor
]);
