import { combineQueueProcessors } from '@metorial/queue';

import { accessQueueProcessor } from '@metorial/module-access';
import { catalogQueueProcessor } from '@metorial/module-catalog';
import { emailQueueProcessor } from '@metorial/module-email';
import { eventQueueProcessor } from '@metorial/module-event';
import { fileQueueProcessor } from '@metorial/module-file';
import { machineAccessQueueProcessor } from '@metorial/module-machine-access';
import { organizationQueueProcessor } from '@metorial/module-organization';
import { searchQueueProcessor } from '@metorial/module-search';
import { secretQueueProcessor } from '@metorial/module-secret';
import { serverDeploymentQueueProcessor } from '@metorial/module-server-deployment';
import { serverRunnerQueueProcessor } from '@metorial/module-server-runner';
import { usageQueueProcessor } from '@metorial/module-usage';
import { userQueueProcessor } from '@metorial/module-user';

combineQueueProcessors([
  userQueueProcessor,
  machineAccessQueueProcessor,
  organizationQueueProcessor,
  emailQueueProcessor,
  accessQueueProcessor,
  fileQueueProcessor,
  catalogQueueProcessor,
  eventQueueProcessor,
  searchQueueProcessor,
  secretQueueProcessor,
  serverDeploymentQueueProcessor,
  usageQueueProcessor,
  serverRunnerQueueProcessor
]).start();
