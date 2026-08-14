import { OrganizationMember } from '@metorial/db';
import { combineQueueProcessors } from '@metorial/queue';
import { sendApprovedConsumerAccessRequestEmailQueueProcessor } from './queues/accessRequest/sendApprovedConsumerAccessRequestEmail';
import { sendRejectedConsumerAccessRequestEmailQueueProcessor } from './queues/accessRequest/sendRejectedConsumerAccessRequestEmail';
import { consumerLifecycleQueueProcessor } from './queues/lifecycle';
import { materializeMagicMcpSessionOwnershipQueueProcessor } from './queues/materializeMagicMcpSessionOwnership';
import {
  reconcileUserConsumerQueueProcessor,
  reconcileUserConsumersQueueProcessor
} from './queues/reconcileUserConsumer';
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
import {
  syncUserConsumerQueueProcessor,
  syncUserConsumersQueueProcessor
} from './queues/syncUserConsumer';

export * from './env';
export * from './lib/consumerEmail';
export * from './lib/consumerProviderContext';
export * from './lib/consumerSurfaceEmailWhitelist';
export * from './lib/magicMcpEndpointAccess';
export * from './lib/magicMcpServerAccess';
export * from './lib/magicMcpTokenAccess';
export * from './lib/oauth';
export * from './portalUrlTemplate';
export * from './queues/lifecycle';
export * from './queues/materializeMagicMcpSessionOwnership';
export * from './queues/reconcileUserConsumer';
export * from './queues/syncUserConsumer';
export * from './services';

export let consumerQueueProcessor = combineQueueProcessors([
  consumerSearchQueueProcessor,
  consumerLifecycleQueueProcessor,
  sendApprovedConsumerAccessRequestEmailQueueProcessor,
  sendRejectedConsumerAccessRequestEmailQueueProcessor,
  syncIdentityConsumerQueueProcessor,
  reconcileConsumerActorQueueProcessor,
  syncUserConsumersQueueProcessor,
  syncUserConsumerQueueProcessor,
  materializeMagicMcpSessionOwnershipQueueProcessor,
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
