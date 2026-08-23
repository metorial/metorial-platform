import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  providerConfigArchivedCleanupCron,
  providerConfigBackendDeleteQueueProcessor,
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
  providerDeploymentBackendDeleteQueueProcessor,
  providerDeploymentDeleteManyQueueProcessor,
  providerDeploymentDeleteQueueProcessor
} from './providerDeployment';

export let deleteQueues = combineQueueProcessors([
  providerConfigArchivedCleanupCron,
  providerConfigDeleteManyQueueProcessor,
  providerConfigDeleteQueueProcessor,
  providerConfigBackendDeleteQueueProcessor,
  providerConfigVaultArchivedCleanupCron,
  providerConfigVaultDeleteManyQueueProcessor,
  providerConfigVaultDeleteQueueProcessor,
  providerDeploymentArchivedCleanupCron,
  providerDeploymentDeleteManyQueueProcessor,
  providerDeploymentDeleteQueueProcessor,
  providerDeploymentBackendDeleteQueueProcessor
]);
