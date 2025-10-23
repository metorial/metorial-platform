process.env.TZ = 'UTC';

import { runQueueProcessors } from '@metorial/queue';

import { accessQueueProcessor } from '@metorial/module-access';
import { callbacksQueueProcessor } from '@metorial/module-callbacks';
import { catalogQueueProcessor } from '@metorial/module-catalog';
import { codeBucketQueueProcessor } from '@metorial/module-code-bucket';
import { communityQueueProcessor } from '@metorial/module-community';
import { customServerQueueProcessor } from '@metorial/module-custom-server';
import { emailQueueProcessor } from '@metorial/module-email';
import { engineQueueProcessor } from '@metorial/module-engine';
import { eventQueueProcessor } from '@metorial/module-event';
import { fileQueueProcessor } from '@metorial/module-file';
import { machineAccessQueueProcessor } from '@metorial/module-machine-access';
import { magicQueueProcessor } from '@metorial/module-magic';
import { organizationQueueProcessor } from '@metorial/module-organization';
import { providerOauthQueueProcessor } from '@metorial/module-provider-oauth';
import { scmQueueProcessor } from '@metorial/module-scm';
import { searchQueueProcessor } from '@metorial/module-search';
import { secretQueueProcessor } from '@metorial/module-secret';
import { serverDeploymentQueueProcessor } from '@metorial/module-server-deployment';
import { serverRunnerQueueProcessor } from '@metorial/module-server-runner';
import { sessionQueueProcessor } from '@metorial/module-session';
import { usageQueueProcessor } from '@metorial/module-usage';
import { userQueueProcessor } from '@metorial/module-user';

export let worker = runQueueProcessors([
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
  serverRunnerQueueProcessor,
  sessionQueueProcessor,
  providerOauthQueueProcessor,
  engineQueueProcessor,
  customServerQueueProcessor,
  codeBucketQueueProcessor,
  communityQueueProcessor,
  magicQueueProcessor,
  scmQueueProcessor,
  callbacksQueueProcessor
]);
