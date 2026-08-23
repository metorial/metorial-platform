import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexIdentityActorQueueProcessor } from './actor';
import { indexAgentQueueProcessor } from './agent';
import { indexIdentityQueueProcessor } from './identity';
import { indexIdentityDelegationConfigQueueProcessor } from './identityDelegationConfig';

export let searchQueues = combineQueueProcessors([
  indexIdentityActorQueueProcessor,
  indexIdentityQueueProcessor,
  indexAgentQueueProcessor,
  indexIdentityDelegationConfigQueueProcessor
]);
