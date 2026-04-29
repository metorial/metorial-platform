import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  integrationArchivedCleanupCron,
  integrationDeleteManyQueueProcessor,
  integrationDeleteQueueProcessor
} from './integration';

export let deleteQueues = combineQueueProcessors([
  integrationArchivedCleanupCron,
  integrationDeleteManyQueueProcessor,
  integrationDeleteQueueProcessor
]);
