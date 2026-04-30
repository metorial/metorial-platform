import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  archiveIntegrationInstanceGroupSessionTemplateQueueProcessor,
  archiveIntegrationInstanceGroupSessionTemplatesQueueProcessor,
  syncIntegrationInstanceGroupSessionTemplateQueueProcessor,
  syncIntegrationInstanceGroupSessionTemplatesQueueProcessor
} from './linkedIntegrationInstanceGroupTemplate';
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
  syncIntegrationInstanceGroupSessionTemplatesQueueProcessor,
  syncIntegrationInstanceGroupSessionTemplateQueueProcessor,
  archiveIntegrationInstanceGroupSessionTemplatesQueueProcessor,
  archiveIntegrationInstanceGroupSessionTemplateQueueProcessor,
  sessionTemplateArchivedQueueProcessor,
  sessionTemplateArchiveSessionsManyQueueProcessor,
  sessionTemplateDeletedQueueProcessor,
  sessionTemplateProviderCreatedQueueProcessor
]);
