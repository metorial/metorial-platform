import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  expireIdentityDelegationsCron,
  expireIdentityDelegationsManyQueueProcessor
} from './delegation';
import {
  expireIdentityDelegationCredentialsCron,
  expireIdentityDelegationCredentialsManyQueueProcessor
} from './delegationCredential';

export let expireQueues = combineQueueProcessors([
  expireIdentityDelegationsCron,
  expireIdentityDelegationsManyQueueProcessor,
  expireIdentityDelegationCredentialsCron,
  expireIdentityDelegationCredentialsManyQueueProcessor
]);
