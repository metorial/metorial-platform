process.env.TZ = 'UTC';

import { runQueueProcessors } from '@metorial/queue';

import { documentQueueProcessor as cargoDocumentQueueProcessor } from '@metorial/module-documents';
import { fileQueueProcessor as cargoFileQueueProcessor } from '@metorial/module-file';
import { storeQueueProcessor as cargoStoreQueueProcessor } from '@metorial/module-store';
import { accessQueueProcessor } from '@metorial/module-access';
import { auditLogStreamQueueProcessor } from '@metorial/module-audit-log-stream';
import { auditLogQueueProcessor } from '@metorial/module-audit-log';
import { auditTrackerQueueProcessor } from '@metorial/module-audit-tracker';
import { communityQueueProcessor } from '@metorial/module-community';
import { consumerAccessQueueProcessor } from '@metorial/module-consumer-access';
import { consumerCoreQueueProcessor } from '@metorial/module-consumer-core';
import { consumerEntitiesQueueProcessor } from '@metorial/module-consumer-entities';
import { consumerOAuthQueueProcessor } from '@metorial/module-consumer-oauth';
import { emailQueueProcessor } from '@metorial/module-email';
import { machineAccessQueueProcessor } from '@metorial/module-machine-access';
import { magicQueueProcessor } from '@metorial/module-magic';
import { organizationQueueProcessor } from '@metorial/module-organization';
import { outpostQueueProcessor } from '@metorial/module-outpost';
import { portalQueueProcessor } from '@metorial/module-portal';
import { productAssistantQueueProcessor } from '@metorial/module-product-assistant';
import { skillQueueProcessor as cargoSkillQueueProcessor } from '@metorial/module-skill';
import { skillConfigurationQueueProcessor } from '@metorial/module-skill-configurations';
import { skillGroupQueueProcessor } from '@metorial/module-skill-groups';
import { skillImportQueueProcessor } from '@metorial/module-skill-import';
import { skillMarketplaceQueueProcessor } from '@metorial/module-skill-marketplace';
import { skillMergeRequestQueueProcessor } from '@metorial/module-skill-merge-requests';
import { skillTemplateQueueProcessor } from '@metorial/module-skill-templates';
import { usageQueueProcessor } from '@metorial/module-usage';
import { userQueueProcessor } from '@metorial/module-user';
import { multiRegionQueueProcessor } from '@metorial/multi-region';

export let worker = runQueueProcessors([
  auditTrackerQueueProcessor,
  auditLogQueueProcessor,
  auditLogStreamQueueProcessor,
  productAssistantQueueProcessor,
  userQueueProcessor,
  machineAccessQueueProcessor,
  organizationQueueProcessor,
  outpostQueueProcessor,
  emailQueueProcessor,
  accessQueueProcessor,
  cargoFileQueueProcessor,
  cargoDocumentQueueProcessor,
  cargoStoreQueueProcessor,
  cargoSkillQueueProcessor,
  skillTemplateQueueProcessor,
  skillGroupQueueProcessor,
  skillConfigurationQueueProcessor,
  skillImportQueueProcessor,
  skillMarketplaceQueueProcessor,
  skillMergeRequestQueueProcessor,
  usageQueueProcessor,
  communityQueueProcessor,
  consumerCoreQueueProcessor,
  consumerAccessQueueProcessor,
  consumerEntitiesQueueProcessor,
  consumerOAuthQueueProcessor,
  portalQueueProcessor,
  magicQueueProcessor,
  multiRegionQueueProcessor
]);
