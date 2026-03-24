import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  providerDeploymentConfigPairCreatedQueueProcessor,
  providerDeploymentConfigPairVersionCreatedQueueProcessor
} from './deploymentConfigPair';
import {
  listingChangedQueueProcessor,
  listingCreatedQueueProcessor,
  listingUpdatedQueueProcessor
} from './listing';
import { providerCreatedQueueProcessor, providerUpdatedQueueProcessor } from './provider';
import {
  providerVersionCreatedQueueProcessor,
  providerVersionUpdatedQueueProcessor
} from './providerVersion';
import { publisherCreatedQueueProcessor, publisherUpdatedQueueProcessor } from './publisher';
import {
  specificationCreatedAssocAuthMethodQueueProcessor,
  specificationCreatedAssocToolQueueProcessor,
  specificationCreatedAssocTriggerQueueProcessor,
  specificationCreatedQueueProcessor
} from './specification';

export let lifecycleQueues = combineQueueProcessors([
  listingCreatedQueueProcessor,
  listingUpdatedQueueProcessor,
  listingChangedQueueProcessor,
  providerCreatedQueueProcessor,
  providerUpdatedQueueProcessor,
  providerVersionCreatedQueueProcessor,
  providerVersionUpdatedQueueProcessor,
  providerDeploymentConfigPairCreatedQueueProcessor,
  providerDeploymentConfigPairVersionCreatedQueueProcessor,
  publisherCreatedQueueProcessor,
  publisherUpdatedQueueProcessor,
  specificationCreatedQueueProcessor,
  specificationCreatedAssocToolQueueProcessor,
  specificationCreatedAssocAuthMethodQueueProcessor,
  specificationCreatedAssocTriggerQueueProcessor
]);
