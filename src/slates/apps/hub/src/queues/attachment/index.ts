import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  slateAttachmentCleanupCron,
  slateAttachmentCleanupManyQueueProcessor,
  slateAttachmentCleanupSingleQueueProcessor
} from './cleanup';
import { slateAttachmentReplicateQueueProcessor } from './replicate';

export let attachmentQueues = combineQueueProcessors([
  slateAttachmentCleanupCron,
  slateAttachmentCleanupManyQueueProcessor,
  slateAttachmentCleanupSingleQueueProcessor,
  slateAttachmentReplicateQueueProcessor
]);
