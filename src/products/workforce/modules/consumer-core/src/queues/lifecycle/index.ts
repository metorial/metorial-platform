import { combineQueueProcessors } from '@metorial/queue';
import { consumerCreatedQueueProcessor, consumerUpdatedQueueProcessor } from './consumer';
import {
  consumerGroupArchivedQueueProcessor,
  consumerGroupCreatedQueueProcessor,
  consumerGroupUpdatedQueueProcessor
} from './consumerGroup';
import {
  consumerInviteCreatedQueueProcessor,
  consumerInviteUpdatedQueueProcessor
} from './consumerInvite';
import {
  consumerProfileCreatedQueueProcessor,
  consumerProfileUpdatedQueueProcessor
} from './consumerProfile';
import {
  consumerSurfaceArchivedQueueProcessor,
  consumerSurfaceCreatedQueueProcessor,
  consumerSurfaceDeletedQueueProcessor,
  consumerSurfaceUpdatedQueueProcessor
} from './consumerSurface';

export * from './consumer';
export * from './consumerGroup';
export * from './consumerInvite';
export * from './consumerProfile';
export * from './consumerSurface';

export let consumerCoreLifecycleQueueProcessor = combineQueueProcessors([
  consumerCreatedQueueProcessor,
  consumerUpdatedQueueProcessor,
  consumerInviteCreatedQueueProcessor,
  consumerInviteUpdatedQueueProcessor,
  consumerProfileCreatedQueueProcessor,
  consumerProfileUpdatedQueueProcessor,
  consumerGroupCreatedQueueProcessor,
  consumerGroupUpdatedQueueProcessor,
  consumerGroupArchivedQueueProcessor,
  consumerSurfaceCreatedQueueProcessor,
  consumerSurfaceUpdatedQueueProcessor,
  consumerSurfaceArchivedQueueProcessor,
  consumerSurfaceDeletedQueueProcessor
]);
