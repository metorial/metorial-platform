import { combineQueueProcessors } from '@mtsrc/queue';
import {
  reconcileManagedCredentialProviderManyQueueProcessor,
  reconcileManagedCredentialProviderSingleQueueProcessor
} from './managedCredentialProvider';
import {
  reconcileAllTenantsManagedBackingsQueueProcessor,
  reconcileTenantManagedBackingsQueueProcessor
} from './tenantManagedBackings';

export * from './managedCredentialProvider';
export * from './tenantManagedBackings';

export let reconcileQueues = combineQueueProcessors([
  reconcileManagedCredentialProviderManyQueueProcessor,
  reconcileManagedCredentialProviderSingleQueueProcessor,
  reconcileTenantManagedBackingsQueueProcessor,
  reconcileAllTenantsManagedBackingsQueueProcessor
]);
