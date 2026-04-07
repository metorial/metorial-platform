import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  providerConfigArchivedCleanupCron,
  providerConfigDeleteManyQueueProcessor,
  providerConfigDeleteQueueProcessor
} from './providerConfig';
import {
  providerConfigVaultArchivedCleanupCron,
  providerConfigVaultDeleteManyQueueProcessor,
  providerConfigVaultDeleteQueueProcessor
} from './providerConfigVault';
import {
  providerDeploymentArchivedCleanupCron,
  providerDeploymentDeleteManyQueueProcessor,
  providerDeploymentDeleteQueueProcessor
} from './providerDeployment';

export let deleteQueues = combineQueueProcessors([
  providerConfigArchivedCleanupCron,
  providerConfigDeleteManyQueueProcessor,
  providerConfigDeleteQueueProcessor,
  providerConfigVaultArchivedCleanupCron,
  providerConfigVaultDeleteManyQueueProcessor,
  providerConfigVaultDeleteQueueProcessor,
  providerDeploymentArchivedCleanupCron,
  providerDeploymentDeleteManyQueueProcessor,
  providerDeploymentDeleteQueueProcessor
]);
