import { combineQueueProcessors } from '@metorial/queue';
import { consumerCreatedQueueProcessor, consumerUpdatedQueueProcessor } from './consumer';
import {
  consumerAccessRequestCreatedQueueProcessor,
  consumerAccessRequestUpdatedQueueProcessor
} from './consumerAccessRequest';
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
export * from './consumerAccessRequest';
export * from './consumerGroup';
export * from './consumerInvite';
export * from './consumerProfile';
export * from './consumerSurface';

export let consumerLifecycleQueueProcessor = combineQueueProcessors([
  consumerCreatedQueueProcessor,
  consumerUpdatedQueueProcessor,
  consumerInviteCreatedQueueProcessor,
  consumerInviteUpdatedQueueProcessor,
  consumerProfileCreatedQueueProcessor,
  consumerProfileUpdatedQueueProcessor,
  consumerGroupCreatedQueueProcessor,
  consumerGroupUpdatedQueueProcessor,
  consumerGroupArchivedQueueProcessor,
  consumerAccessRequestCreatedQueueProcessor,
  consumerAccessRequestUpdatedQueueProcessor,
  consumerSurfaceCreatedQueueProcessor,
  consumerSurfaceUpdatedQueueProcessor,
  consumerSurfaceArchivedQueueProcessor,
  consumerSurfaceDeletedQueueProcessor
]);
