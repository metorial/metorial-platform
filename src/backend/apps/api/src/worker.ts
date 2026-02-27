process.env.TZ = 'UTC';

import { runQueueProcessors } from '@metorial/queue';

import { accessQueueProcessor } from '@metorial/module-access';
import { communityQueueProcessor } from '@metorial/module-community';
import { emailQueueProcessor } from '@metorial/module-email';
import { eventQueueProcessor } from '@metorial/module-event';
import { fileQueueProcessor } from '@metorial/module-file';
import { machineAccessQueueProcessor } from '@metorial/module-machine-access';
import { magicQueueProcessor } from '@metorial/module-magic';
import { organizationQueueProcessor } from '@metorial/module-organization';
import { protectQueueProcessor } from '@metorial/module-protect';
import { searchQueueProcessor } from '@metorial/module-search';
import { subspaceQueueProcessor } from '@metorial/module-subspace';
import { usageQueueProcessor } from '@metorial/module-usage';
import { userQueueProcessor } from '@metorial/module-user';

export let worker = runQueueProcessors([
  userQueueProcessor,
  machineAccessQueueProcessor,
  organizationQueueProcessor,
  emailQueueProcessor,
  accessQueueProcessor,
  fileQueueProcessor,
  eventQueueProcessor,
  searchQueueProcessor,
  usageQueueProcessor,
  communityQueueProcessor,
  magicQueueProcessor,
  protectQueueProcessor,
  subspaceQueueProcessor
]);
