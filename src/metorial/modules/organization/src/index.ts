import { combineQueueProcessors } from '@metorial/queue';
import {
  createOrganizationNotificationDestinationProcessor,
  createOrganizationNotificationProcessor
} from './queues/createNotification';
import { reconcileAuthVersionProcessors } from './queues/reconcileAuthVersion';
import { reconcileDefaultPoliciesProcessors } from './queues/reconcileDefaultPolicies';
import { reconcileProjectInstancesProcessors } from './queues/reconcileProjectInstances';
import {
  syncBrandOrganizationQueueProcessor,
  syncBrandQueueProcessor
} from './queues/syncBrand';
import { syncProfileQueueProcessor } from './queues/syncProfile';
import { sendOrganizationNotificationEmailProcessor } from './queues/sendNotificationEmail';
import { syncSubspaceTenantProcessors } from './queues/syncSubspaceTenant';
export { syncSubspaceTenantQueue } from './queues/syncSubspaceTenant';

export * from './definitions';
export * from './services';

export let organizationQueueProcessor = combineQueueProcessors([
  syncBrandQueueProcessor,
  syncBrandOrganizationQueueProcessor,

  syncProfileQueueProcessor,

  createOrganizationNotificationProcessor,
  createOrganizationNotificationDestinationProcessor,
  sendOrganizationNotificationEmailProcessor,

  reconcileAuthVersionProcessors,
  reconcileDefaultPoliciesProcessors,
  reconcileProjectInstancesProcessors,

  syncSubspaceTenantProcessors
]);
