import { OrganizationMember } from '@metorial/db';
import { combineQueueProcessors } from '@metorial/queue';
import { sendApprovedConsumerAccessRequestEmailQueueProcessor } from './queues/accessRequest/sendApprovedConsumerAccessRequestEmail';
import { sendRejectedConsumerAccessRequestEmailQueueProcessor } from './queues/accessRequest/sendRejectedConsumerAccessRequestEmail';
import { backfillAccessListingsProcessors } from './queues/backfillAccessListings';
import { consumerLifecycleQueueProcessor } from './queues/lifecycle';
import { reconcileConsumerClientProcessors } from './queues/reconcileConsumerClient';
import { reconcileConsumerAuthClientOwnershipProcessors } from './queues/reconcileConsumerAuthClientOwnership';
import { reconcileMagicMcpConsumerOwnershipProcessors } from './queues/reconcileMagicMcpConsumerOwnership';
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

export * from './env';
export * from './lib/consumerProviderContext';
export * from './lib/consumerSurfaceEmailWhitelist';
export * from './lib/magicMcpEndpointAccess';
export * from './lib/magicMcpServerAccess';
export * from './lib/magicMcpTokenAccess';
export * from './lib/oauth';
export * from './portalUrlTemplate';
export * from './services';

export let consumerQueueProcessor = combineQueueProcessors([
  consumerSearchQueueProcessor,
  consumerLifecycleQueueProcessor,
  sendApprovedConsumerAccessRequestEmailQueueProcessor,
  sendRejectedConsumerAccessRequestEmailQueueProcessor,
  syncIdentityConsumerQueueProcessor,
  reconcileConsumerActorQueueProcessor,
  backfillAccessListingsProcessors,
  reconcileMagicMcpConsumerOwnershipProcessors,
  reconcileConsumerClientProcessors,
  reconcileConsumerAuthClientOwnershipProcessors,

  syncOrgMemberQueueProcessor,
  syncOrgMemberConsumerQueueProcessor,
  createOrgMemberConsumerForInstanceQueueProcessor
]);

export let syncOrgMemberToConsumer = (member: OrganizationMember) =>
  syncOrgMemberQueue.add({
    memberId: member.id
  });
