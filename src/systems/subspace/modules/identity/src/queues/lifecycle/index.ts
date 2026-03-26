import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  identityActorCreatedQueueProcessor,
  identityActorUpdatedQueueProcessor
} from './actor';
import { agentCreatedQueueProcessor, agentUpdatedQueueProcessor } from './agent';
import { identityCreatedQueueProcessor, identityUpdatedQueueProcessor } from './identity';
import {
  identityCredentialCreatedQueueProcessor,
  identityCredentialDeletedQueueProcessor,
  identityCredentialUpdatedQueueProcessor
} from './identityCredential';
import {
  identityDelegationConfigCreatedQueueProcessor,
  identityDelegationConfigDeletedQueueProcessor,
  identityDelegationConfigUpdatedQueueProcessor
} from './identityDelegationConfig';

export let lifecycleQueues = combineQueueProcessors([
  agentCreatedQueueProcessor,
  agentUpdatedQueueProcessor,
  identityCreatedQueueProcessor,
  identityUpdatedQueueProcessor,
  identityActorCreatedQueueProcessor,
  identityActorUpdatedQueueProcessor,
  identityCredentialCreatedQueueProcessor,
  identityCredentialUpdatedQueueProcessor,
  identityCredentialDeletedQueueProcessor,
  identityDelegationConfigCreatedQueueProcessor,
  identityDelegationConfigUpdatedQueueProcessor,
  identityDelegationConfigDeletedQueueProcessor
]);
