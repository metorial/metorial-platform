import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexProviderAuthConfigQueueProcessor } from './providerAuthConfig';
import { indexProviderAuthCredentialsQueueProcessor } from './providerAuthCredentials';

export let searchQueues = combineQueueProcessors([
  indexProviderAuthConfigQueueProcessor,
  indexProviderAuthCredentialsQueueProcessor
]);
