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
  sessionArchivedChildrenQueueProcessor,
  sessionArchivedQueueProcessor,
  sessionCreatedQueueProcessor,
  sessionDeletedQueueProcessor,
  sessionUpdatedQueueProcessor
} from './session';
import { sessionProviderCreatedQueueProcessor } from './sessionProvider';
import {
  sessionTemplateArchivedQueueProcessor,
  sessionTemplateArchiveSessionsManyQueueProcessor,
  sessionTemplateInvalidateRuntimeQueueProcessor,
  sessionTemplateDeletedQueueProcessor
} from './sessionTemplate';
import {
  sessionTemplateProviderCreatedQueueProcessor,
  sessionTemplateSyncHashQueueProcessor
} from './sessionTemplateProvider';

export let lifecycleQueues = combineQueueProcessors([
  sessionCreatedQueueProcessor,
  sessionUpdatedQueueProcessor,
  sessionArchivedQueueProcessor,
  sessionArchivedChildrenQueueProcessor,
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
  sessionTemplateInvalidateRuntimeQueueProcessor,
  sessionTemplateDeletedQueueProcessor,
  sessionTemplateProviderCreatedQueueProcessor,
  sessionTemplateSyncHashQueueProcessor
]);
