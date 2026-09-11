import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexProviderConfigQueueProcessor } from './providerConfig';
import { indexProviderConfigVaultQueueProcessor } from './providerConfigVault';
import { indexProviderDeploymentQueueProcessor } from './providerDeployment';

export let searchQueues = combineQueueProcessors([
  indexProviderConfigQueueProcessor,
  indexProviderConfigVaultQueueProcessor,
  indexProviderDeploymentQueueProcessor
]);
