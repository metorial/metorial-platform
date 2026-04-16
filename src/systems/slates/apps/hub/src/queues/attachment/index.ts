import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  slateAttachmentCleanupCron,
  slateAttachmentCleanupManyQueueProcessor,
  slateAttachmentCleanupSingleQueueProcessor
} from './cleanup';

export let attachmentQueues = combineQueueProcessors([
  slateAttachmentCleanupCron,
  slateAttachmentCleanupManyQueueProcessor,
  slateAttachmentCleanupSingleQueueProcessor
]);
