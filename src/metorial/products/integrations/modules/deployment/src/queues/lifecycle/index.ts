import { combineQueueProcessors } from '@lowerdeck/queue';
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

export let lifecycleSubspaceQueues = combineQueueProcessors([
  providerConfigCreatedQueueProcessor,
  providerConfigUpdatedQueueProcessor,
  providerConfigVaultCreatedQueueProcessor,
  providerConfigVaultUpdatedQueueProcessor,
  providerDeploymentCreatedQueueProcessor,
  providerDeploymentUpdatedQueueProcessor
]);

export let lifecycleFederationQueues = combineQueueProcessors([
  providerConfigArchivedQueueProcessor,
  providerConfigDeletedQueueProcessor,
  providerConfigVaultArchivedQueueProcessor,
  providerConfigVaultArchiveConfigsManyQueueProcessor,
  providerConfigVaultDeletedQueueProcessor,
  providerDeploymentArchivedQueueProcessor,
  providerDeploymentArchiveConfigsManyQueueProcessor,
  providerDeploymentArchiveConfigVaultsManyQueueProcessor,
  providerDeploymentArchiveAuthConfigsManyQueueProcessor,
  providerDeploymentDeletedQueueProcessor
]);
