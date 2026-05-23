import { combineQueueProcessors } from '@mtsrc/queue';
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
