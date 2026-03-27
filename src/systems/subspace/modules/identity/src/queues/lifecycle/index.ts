import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  identityActorCreatedQueueProcessor,
  identityActorDeletedQueueProcessor,
  identityActorUpdatedQueueProcessor
} from './actor';
import {
  agentCreatedQueueProcessor,
  agentDeletedQueueProcessor,
  agentUpdatedQueueProcessor
} from './agent';
import {
  identityDelegationCreatedQueueProcessor,
  identityDelegationUpdatedQueueProcessor
} from './delegation';
import {
  identityCreatedQueueProcessor,
  identityDeletedQueueProcessor,
  identityUpdatedQueueProcessor
} from './identity';
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
  agentDeletedQueueProcessor,
  identityCreatedQueueProcessor,
  identityUpdatedQueueProcessor,
  identityDeletedQueueProcessor,
  identityActorCreatedQueueProcessor,
  identityActorUpdatedQueueProcessor,
  identityActorDeletedQueueProcessor,
  identityCredentialCreatedQueueProcessor,
  identityCredentialUpdatedQueueProcessor,
  identityCredentialDeletedQueueProcessor,
  identityDelegationCreatedQueueProcessor,
  identityDelegationUpdatedQueueProcessor,
  identityDelegationConfigCreatedQueueProcessor,
  identityDelegationConfigUpdatedQueueProcessor,
  identityDelegationConfigDeletedQueueProcessor
]);
