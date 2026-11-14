import { combineQueueProcessors } from '@metorial/queue';
import { magicBackingBackfillQueueProcessor } from './backingBackfill';
import { magicLifecycleQueueProcessor } from './lifecycle';
import { magicOwnerActorQueueProcessor } from './ownerActor';
import { magicOwnerIdentityQueueProcessor } from './ownerIdentity';
import { magicSearchQueueProcessor } from './search';

export * from './lifecycle';
export * from './search';

export let magicQueues = combineQueueProcessors([
  magicLifecycleQueueProcessor,
  magicSearchQueueProcessor,
  magicOwnerActorQueueProcessor,
  magicOwnerIdentityQueueProcessor,
  magicBackingBackfillQueueProcessor
]);
