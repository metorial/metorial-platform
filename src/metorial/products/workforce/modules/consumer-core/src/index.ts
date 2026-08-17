import { OrganizationMember } from '@metorial/db';
import { combineQueueProcessors } from '@metorial/queue';
import { consumerCreatedQueueProcessor, consumerUpdatedQueueProcessor } from './queues/lifecycle/consumer';
import {
  consumerGroupArchivedQueueProcessor,
  consumerGroupCreatedQueueProcessor,
  consumerGroupUpdatedQueueProcessor
} from './queues/lifecycle/consumerGroup';
import {
  consumerInviteCreatedQueueProcessor,
  consumerInviteUpdatedQueueProcessor
} from './queues/lifecycle/consumerInvite';
import {
  consumerProfileCreatedQueueProcessor,
  consumerProfileUpdatedQueueProcessor
} from './queues/lifecycle/consumerProfile';
import {
  consumerSurfaceArchivedQueueProcessor,
  consumerSurfaceCreatedQueueProcessor,
  consumerSurfaceDeletedQueueProcessor,
  consumerSurfaceUpdatedQueueProcessor
} from './queues/lifecycle/consumerSurface';
import { indexConsumerSearchQueueProcessor } from './queues/search/consumer';
import { indexConsumerGroupSearchQueueProcessor } from './queues/search/consumerGroup';
import {
  reconcileUserConsumerQueueProcessor,
  reconcileUserConsumersQueueProcessor
} from './queues/reconcileUserConsumer';
import {
  reconcileConsumerActorQueueProcessor,
  syncIdentityConsumerQueueProcessor
} from './queues/syncIdentityConsumer';
import {
  createOrgMemberConsumerForInstanceQueueProcessor,
  syncOrgMemberConsumerQueueProcessor,
  syncOrgMemberQueue,
  syncOrgMemberQueueProcessor
} from './queues/syncOrgMember';
import {
  syncUserConsumerQueueProcessor,
  syncUserConsumersQueueProcessor
} from './queues/syncUserConsumer';

export * from './services';
export { syncUserToConsumers } from './queues/syncUserConsumer';

export let consumerCoreQueueProcessor = combineQueueProcessors([
  indexConsumerSearchQueueProcessor,
  indexConsumerGroupSearchQueueProcessor,
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
  consumerSurfaceDeletedQueueProcessor,
  syncIdentityConsumerQueueProcessor,
  reconcileConsumerActorQueueProcessor,
  syncUserConsumersQueueProcessor,
  syncUserConsumerQueueProcessor,
  reconcileUserConsumersQueueProcessor,
  reconcileUserConsumerQueueProcessor,
  syncOrgMemberQueueProcessor,
  syncOrgMemberConsumerQueueProcessor,
  createOrgMemberConsumerForInstanceQueueProcessor
]);

export let syncOrgMemberToConsumer = (member: OrganizationMember) =>
  syncOrgMemberQueue.add({
    memberId: member.id
  });
