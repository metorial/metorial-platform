import { combineQueueProcessors } from '@mtsrc/queue';
import {
  providerConfigArchivedQueueProcessor,
  providerConfigCreatedQueueProcessor,
  providerConfigDeletedQueueProcessor,
  providerConfigUpdatedQueueProcessor
} from './providerConfig';
import {
  providerConfigVaultArchiveConfigsManyQueueProcessor,
  providerConfigVaultArchivedQueueProcessor,
  providerConfigVaultCreatedQueueProcessor,
  providerConfigVaultDeletedQueueProcessor,
  providerConfigVaultUpdatedQueueProcessor
} from './providerConfigVault';
import {
  providerDeploymentArchiveAuthConfigsManyQueueProcessor,
  providerDeploymentArchiveConfigsManyQueueProcessor,
  providerDeploymentArchiveConfigVaultsManyQueueProcessor,
  providerDeploymentArchivedQueueProcessor,
  providerDeploymentCreatedQueueProcessor,
  providerDeploymentDeletedQueueProcessor,
  providerDeploymentUpdatedQueueProcessor
} from './providerDeployment';

export let lifecycleQueues = combineQueueProcessors([
  providerConfigCreatedQueueProcessor,
  providerConfigUpdatedQueueProcessor,
  providerConfigArchivedQueueProcessor,
  providerConfigDeletedQueueProcessor,
  providerConfigVaultCreatedQueueProcessor,
  providerConfigVaultUpdatedQueueProcessor,
  providerConfigVaultArchivedQueueProcessor,
  providerConfigVaultArchiveConfigsManyQueueProcessor,
  providerConfigVaultDeletedQueueProcessor,
  providerDeploymentCreatedQueueProcessor,
  providerDeploymentUpdatedQueueProcessor,
  providerDeploymentArchivedQueueProcessor,
  providerDeploymentArchiveConfigsManyQueueProcessor,
  providerDeploymentArchiveConfigVaultsManyQueueProcessor,
  providerDeploymentArchiveAuthConfigsManyQueueProcessor,
  providerDeploymentDeletedQueueProcessor
]);
