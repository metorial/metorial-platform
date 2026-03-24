import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  providerConfigCreatedQueueProcessor,
  providerConfigUpdatedQueueProcessor
} from './providerConfig';
import {
  providerConfigVaultCreatedQueueProcessor,
  providerConfigVaultUpdatedQueueProcessor
} from './providerConfigVault';
import {
  providerDeploymentCreatedQueueProcessor,
  providerDeploymentUpdatedQueueProcessor
} from './providerDeployment';

export let lifecycleQueues = combineQueueProcessors([
  providerConfigCreatedQueueProcessor,
  providerConfigUpdatedQueueProcessor,
  providerConfigVaultCreatedQueueProcessor,
  providerConfigVaultUpdatedQueueProcessor,
  providerDeploymentCreatedQueueProcessor,
  providerDeploymentUpdatedQueueProcessor
]);
