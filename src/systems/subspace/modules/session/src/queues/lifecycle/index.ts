import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  sessionArchivedQueueProcessor,
  sessionCreatedQueueProcessor,
  sessionDeletedQueueProcessor,
  sessionUpdatedQueueProcessor
} from './session';
import { sessionProviderCreatedQueueProcessor } from './sessionProvider';
import {
  sessionTemplateArchivedQueueProcessor,
  sessionTemplateArchiveSessionsManyQueueProcessor,
  sessionTemplateDeletedQueueProcessor
} from './sessionTemplate';
import { sessionTemplateProviderCreatedQueueProcessor } from './sessionTemplateProvider';

export let lifecycleQueues = combineQueueProcessors([
  sessionCreatedQueueProcessor,
  sessionUpdatedQueueProcessor,
  sessionArchivedQueueProcessor,
  sessionDeletedQueueProcessor,
  sessionProviderCreatedQueueProcessor,
  sessionTemplateArchivedQueueProcessor,
  sessionTemplateArchiveSessionsManyQueueProcessor,
  sessionTemplateDeletedQueueProcessor,
  sessionTemplateProviderCreatedQueueProcessor
]);
