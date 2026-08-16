process.env.TZ = 'UTC';

import { runQueueProcessors } from '@metorial/queue';

import { documentQueueProcessor as cargoDocumentQueueProcessor } from '@metorial/cargo-module-doc';
import { fileQueueProcessor as cargoFileQueueProcessor } from '@metorial/cargo-module-file';
import { skillQueueProcessor as cargoSkillQueueProcessor } from '@metorial/cargo-module-skill';
import { storeQueueProcessor as cargoStoreQueueProcessor } from '@metorial/cargo-module-store';
import { accessQueueProcessor } from '@metorial/module-access';
import { auditLogStreamQueueProcessor } from '@metorial/module-audit-log-stream';
import { auditTrackerQueueProcessor } from '@metorial/module-audit-tracker';
import { communityQueueProcessor } from '@metorial/module-community';
import { consumerQueueProcessor } from '@metorial/module-consumer';
import { emailQueueProcessor } from '@metorial/module-email';
import { eventQueueProcessor } from '@metorial/module-event';
import { machineAccessQueueProcessor } from '@metorial/module-machine-access';
import { magicQueueProcessor } from '@metorial/module-magic';
import { organizationQueueProcessor } from '@metorial/module-organization';
import { productAssistantQueueProcessor } from '@metorial/module-product-assistant';
import { skillMergeRequestQueueProcessor } from '@metorial/module-skill-merge-requests';
import { usageQueueProcessor } from '@metorial/module-usage';
import { userQueueProcessor } from '@metorial/module-user';
import { multiRegionQueueProcessor } from '@metorial/multi-region';

export let worker = runQueueProcessors([
  auditTrackerQueueProcessor,
  auditLogStreamQueueProcessor,
  productAssistantQueueProcessor,
  userQueueProcessor,
  machineAccessQueueProcessor,
  organizationQueueProcessor,
  emailQueueProcessor,
  accessQueueProcessor,
  cargoFileQueueProcessor,
  cargoDocumentQueueProcessor,
  cargoStoreQueueProcessor,
  cargoSkillQueueProcessor,
  skillMergeRequestQueueProcessor,
  eventQueueProcessor,
  usageQueueProcessor,
  communityQueueProcessor,
  consumerQueueProcessor,
  magicQueueProcessor,
  multiRegionQueueProcessor
]);
