process.env.TZ = 'UTC';

import { runQueueProcessors } from '@metorial/queue';

import { documentQueueProcessor as cargoDocumentQueueProcessor } from '@metorial/cargo-module-doc';
import { fileQueueProcessor as cargoFileQueueProcessor } from '@metorial/cargo-module-file';
import { skillQueueProcessor as cargoSkillQueueProcessor } from '@metorial/cargo-module-skill';
import { storeQueueProcessor as cargoStoreQueueProcessor } from '@metorial/cargo-module-store';
import { accessQueueProcessor } from '@metorial/module-access';
import { assistantQueueProcessor } from '@metorial/module-assistant';
import { communityQueueProcessor } from '@metorial/module-community';
import { consumerQueueProcessor } from '@metorial/module-consumer';
import { emailQueueProcessor } from '@metorial/module-email';
import { eventQueueProcessor } from '@metorial/module-event';
import { machineAccessQueueProcessor } from '@metorial/module-machine-access';
import { magicQueueProcessor } from '@metorial/module-magic';
import { organizationQueueProcessor } from '@metorial/module-organization';
import { protectQueueProcessor } from '@metorial/module-protect';
import { subspaceQueueProcessor } from '@metorial/module-subspace';
import { usageQueueProcessor } from '@metorial/module-usage';
import { userQueueProcessor } from '@metorial/module-user';
import { multiRegionQueueProcessor } from '@metorial/multi-region';

export let worker = runQueueProcessors([
  assistantQueueProcessor,
  userQueueProcessor,
  machineAccessQueueProcessor,
  organizationQueueProcessor,
  emailQueueProcessor,
  accessQueueProcessor,
  cargoFileQueueProcessor,
  cargoDocumentQueueProcessor,
  cargoStoreQueueProcessor,
  cargoSkillQueueProcessor,
  eventQueueProcessor,
  usageQueueProcessor,
  communityQueueProcessor,
  consumerQueueProcessor,
  magicQueueProcessor,
  protectQueueProcessor,
  subspaceQueueProcessor,
  multiRegionQueueProcessor
]);
