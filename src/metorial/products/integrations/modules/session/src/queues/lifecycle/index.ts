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
  sessionDeletedQueueProcessor,
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
  sessionTemplateInvalidateRuntimeQueueProcessor,
  sessionTemplateDeletedQueueProcessor,
  sessionTemplateProviderCreatedQueueProcessor,
  sessionTemplateSyncHashQueueProcessor
]);

export let lifecycleSubspaceQueues = combineQueueProcessors([
  sessionArchivedQueueProcessor,
  syncIntegrationInstanceSessionTemplatesQueueProcessor,
  syncIntegrationInstanceSessionTemplateQueueProcessor,
  syncIntegrationInstanceGroupSessionTemplatesQueueProcessor,
  syncIntegrationInstanceGroupSessionTemplateQueueProcessor,
  sessionTemplateInvalidateRuntimeQueueProcessor
]);

export let lifecycleFederationQueues = combineQueueProcessors([
  sessionCreatedQueueProcessor,
  sessionUpdatedQueueProcessor,
  sessionDeletedQueueProcessor,
  sessionProviderCreatedQueueProcessor,
  archiveIntegrationInstanceSessionTemplatesQueueProcessor,
  archiveIntegrationInstanceSessionTemplateQueueProcessor,
  archiveIntegrationInstanceGroupSessionTemplatesQueueProcessor,
  archiveIntegrationInstanceGroupSessionTemplateQueueProcessor,
  sessionTemplateArchivedQueueProcessor,
  sessionTemplateArchiveSessionsManyQueueProcessor,
  sessionTemplateDeletedQueueProcessor,
  sessionTemplateProviderCreatedQueueProcessor,
  sessionTemplateSyncHashQueueProcessor
]);
