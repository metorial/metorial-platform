import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  chatArchivedCleanupCron,
  chatDeleteManyQueueProcessor,
  chatDeleteQueueProcessor
} from './chat';
import {
  chatConnectionArchivedCleanupCron,
  chatConnectionDeleteManyQueueProcessor,
  chatConnectionDeleteQueueProcessor
} from './chatConnection';
import {
  chatInstanceArchivedCleanupCron,
  chatInstanceDeleteManyQueueProcessor,
  chatInstanceDeleteQueueProcessor
} from './chatInstance';
import {
  chatMessageDeletedCleanupCron,
  chatMessageDeleteManyQueueProcessor,
  chatMessageDeleteQueueProcessor
} from './chatMessage';

export let deleteQueues = combineQueueProcessors([
  chatArchivedCleanupCron,
  chatDeleteManyQueueProcessor,
  chatDeleteQueueProcessor,
  chatConnectionArchivedCleanupCron,
  chatConnectionDeleteManyQueueProcessor,
  chatConnectionDeleteQueueProcessor,
  chatInstanceArchivedCleanupCron,
  chatInstanceDeleteManyQueueProcessor,
  chatInstanceDeleteQueueProcessor,
  chatMessageDeletedCleanupCron,
  chatMessageDeleteManyQueueProcessor,
  chatMessageDeleteQueueProcessor
]);
