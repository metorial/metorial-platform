import { combineQueueProcessors } from '@metorial/queue';
import { reconcileOrganizationMembersProcessors } from './queues/reconcileOrganizationMembers';

export * from './services/portal';
export * from './services/projectWorkforceConfiguration';

export let portalQueueProcessor = combineQueueProcessors([
  reconcileOrganizationMembersProcessors
]);
