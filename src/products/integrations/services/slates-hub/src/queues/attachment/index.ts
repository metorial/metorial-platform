import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  slateAttachmentCleanupCron,
  slateAttachmentCleanupManyQueueProcessor,
  slateAttachmentCleanupSingleQueueProcessor,
  slateAttachmentStoredContentCleanupQueueProcessor,
  slateAttachmentUploadCleanupManyQueueProcessor,
  slateAttachmentUploadCleanupSingleQueueProcessor
} from './cleanup';
import { slateAttachmentUploadDeleteQueueProcessor } from './uploadDelete';

export let attachmentQueues = combineQueueProcessors([
  slateAttachmentCleanupCron,
  slateAttachmentCleanupManyQueueProcessor,
  slateAttachmentCleanupSingleQueueProcessor,
  slateAttachmentUploadCleanupManyQueueProcessor,
  slateAttachmentUploadCleanupSingleQueueProcessor,
  slateAttachmentStoredContentCleanupQueueProcessor,
  slateAttachmentUploadDeleteQueueProcessor
]);
