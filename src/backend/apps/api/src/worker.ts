import { combineQueueProcessors } from '@metorial/queue';

import { accessQueueProcessor } from '@metorial/module-access';
import { catalogQueueProcessor } from '@metorial/module-catalog';
import { emailQueueProcessor } from '@metorial/module-email';
import { fileQueueProcessor } from '@metorial/module-file';
import { machineAccessQueueProcessor } from '@metorial/module-machine-access';
import { organizationQueueProcessor } from '@metorial/module-organization';
import { userQueueProcessor } from '@metorial/module-user';

combineQueueProcessors([
  userQueueProcessor,
  machineAccessQueueProcessor,
  organizationQueueProcessor,
  emailQueueProcessor,
  accessQueueProcessor,
  fileQueueProcessor,
  catalogQueueProcessor
]).start();
