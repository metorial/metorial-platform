import { combineQueueProcessors } from '@metorial/queue';

import { accessQueueProcessor } from '@metorial/module-access';
import { emailQueueProcessor } from '@metorial/module-email';
import { machineAccessQueueProcessor } from '@metorial/module-machine-access';
import { organizationQueueProcessor } from '@metorial/module-organization';
import { userQueueProcessor } from '@metorial/module-user';

combineQueueProcessors([
  userQueueProcessor,
  machineAccessQueueProcessor,
  organizationQueueProcessor,
  emailQueueProcessor,
  accessQueueProcessor
]).start();
