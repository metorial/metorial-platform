import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  archiveDelegatedIntegrationInstanceSessionTemplateQueueProcessor,
  archiveDelegatedIntegrationInstanceSessionTemplatesQueueProcessor,
  syncDelegatedIntegrationInstanceSessionTemplateQueueProcessor,
  syncDelegatedIntegrationInstanceSessionTemplatesQueueProcessor
} from './linkedDelegatedIntegrationTemplate';
import {
  archiveIntegrationInstanceSessionTemplateQueueProcessor,
  archiveIntegrationInstanceSessionTemplatesQueueProcessor,
  syncIntegrationInstanceSessionTemplateQueueProcessor,
  syncIntegrationInstanceSessionTemplatesQueueProcessor
} from './linkedSessionTemplate';
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
  syncIntegrationInstanceSessionTemplatesQueueProcessor,
  syncIntegrationInstanceSessionTemplateQueueProcessor,
  archiveIntegrationInstanceSessionTemplatesQueueProcessor,
  archiveIntegrationInstanceSessionTemplateQueueProcessor,
  syncDelegatedIntegrationInstanceSessionTemplatesQueueProcessor,
  syncDelegatedIntegrationInstanceSessionTemplateQueueProcessor,
  archiveDelegatedIntegrationInstanceSessionTemplatesQueueProcessor,
  archiveDelegatedIntegrationInstanceSessionTemplateQueueProcessor,
  sessionTemplateArchivedQueueProcessor,
  sessionTemplateArchiveSessionsManyQueueProcessor,
  sessionTemplateDeletedQueueProcessor,
  sessionTemplateProviderCreatedQueueProcessor
]);
