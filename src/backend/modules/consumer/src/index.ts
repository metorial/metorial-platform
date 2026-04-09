import { OrganizationMember } from '@metorial/db';
import { combineQueueProcessors } from '@metorial/queue';
import { consumerLifecycleQueueProcessor } from './queues/lifecycle';
import { consumerSearchQueueProcessor } from './queues/search';
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

export * from './services';

export let consumerQueueProcessor = combineQueueProcessors([
  consumerSearchQueueProcessor,
  consumerLifecycleQueueProcessor,
  syncIdentityConsumerQueueProcessor,
  reconcileConsumerActorQueueProcessor,

  syncOrgMemberQueueProcessor,
  syncOrgMemberConsumerQueueProcessor,
  createOrgMemberConsumerForInstanceQueueProcessor
]);

export let syncOrgMemberToConsumer = (member: OrganizationMember) =>
  syncOrgMemberQueue.add({
    memberId: member.id
  });
