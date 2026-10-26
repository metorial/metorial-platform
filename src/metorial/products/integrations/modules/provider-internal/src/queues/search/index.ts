import { combineQueueProcessors } from '@lowerdeck/queue';
import { providerAuthMethodSearchProcessors } from './providerAuthMethod';
import { indexProviderListingQueueProcessor } from './providerListing';
import { providerToolSearchProcessors } from './providerTool';
import { indexPublisherQueueProcessor } from './publisher';
import { reconcileSearchProcessors } from './reconcile';

export let searchQueues = combineQueueProcessors([
  indexProviderListingQueueProcessor,
  indexPublisherQueueProcessor,
  providerToolSearchProcessors,
  providerAuthMethodSearchProcessors,
  reconcileSearchProcessors
]);
