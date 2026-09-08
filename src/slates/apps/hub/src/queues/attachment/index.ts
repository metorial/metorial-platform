import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  slateAttachmentCleanupCron,
  slateAttachmentCleanupManyQueueProcessor,
  slateAttachmentCleanupSingleQueueProcessor,
  slateAttachmentUploadCleanupManyQueueProcessor,
  slateAttachmentUploadCleanupSingleQueueProcessor,
  slateAttachmentUploadedContentCleanupQueueProcessor
} from './cleanup';
import { slateAttachmentUploadDeleteQueueProcessor } from './uploadDelete';

export let attachmentQueues = combineQueueProcessors([
  slateAttachmentCleanupCron,
  slateAttachmentCleanupManyQueueProcessor,
  slateAttachmentCleanupSingleQueueProcessor,
  slateAttachmentUploadCleanupManyQueueProcessor,
  slateAttachmentUploadCleanupSingleQueueProcessor,
  slateAttachmentUploadedContentCleanupQueueProcessor,
  slateAttachmentUploadDeleteQueueProcessor
]);
