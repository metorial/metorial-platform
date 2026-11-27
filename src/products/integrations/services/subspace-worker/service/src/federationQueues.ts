import { combineQueueProcessors } from '@lowerdeck/queue';
import { agentFederationQueueProcessor } from '@metorial-subspace/module-agent/src/queues';
import {
  authFederationQueueProcessor,
  reconcileManagedCredentialProviderManyQueue
} from '@metorial-subspace/module-auth/src/queues';
import { callbackFederationQueueProcessor } from '@metorial-subspace/module-callback/src/queues';
import { catalogFederationQueueProcessor } from '@metorial-subspace/module-catalog/src/queues';
import { connectionFederationQueueProcessor } from '@metorial-subspace/module-connection/src/queueProcessor';
import { customProviderFederationQueueProcessor } from '@metorial-subspace/module-custom-provider/src/queues';
import { deploymentFederationQueueProcessor } from '@metorial-subspace/module-deployment/src/queues';
import { enclaveFederationQueueProcessor } from '@metorial-subspace/module-enclave/src/queues';
import { identityFederationQueueProcessor } from '@metorial-subspace/module-identity/src/queues';
import { integrationFederationQueueProcessor } from '@metorial-subspace/module-integration/src/queues';
import { chatFederationQueueProcessor } from '@metorial-subspace/module-chat/src/queues';
import { monitorFederationQueueProcessor } from '@metorial-subspace/module-monitor/src/queues';
import { providerInternalFederationQueueProcessor } from '@metorial-subspace/module-provider-internal/src/queues';
import { sessionFederationQueueProcessor } from '@metorial-subspace/module-session/src/queues';
import { tenantFederationQueueProcessors } from '@metorial-subspace/module-tenant/src/queues';
import { nativeProviderFederationQueues } from '@metorial-subspace/provider-native';
import { shuttleProviderFederationQueues } from '@metorial-subspace/provider-shuttle';
import { slatesProviderFederationQueues } from '@metorial-subspace/provider-slates';

export let subspaceFederationQueueProcessor = combineQueueProcessors([
  sessionFederationQueueProcessor,
  connectionFederationQueueProcessor,
  authFederationQueueProcessor,
  catalogFederationQueueProcessor,
  deploymentFederationQueueProcessor,
  enclaveFederationQueueProcessor,
  tenantFederationQueueProcessors,
  providerInternalFederationQueueProcessor,
  nativeProviderFederationQueues,
  slatesProviderFederationQueues,
  shuttleProviderFederationQueues,
  customProviderFederationQueueProcessor,
  callbackFederationQueueProcessor,
  identityFederationQueueProcessor,
  integrationFederationQueueProcessor,
  chatFederationQueueProcessor,
  monitorFederationQueueProcessor,
  agentFederationQueueProcessor
]);

export let startSubspaceFederationBootJobs = () => {
  setTimeout(() => {
    reconcileManagedCredentialProviderManyQueue.add(
      {},
      { id: 'boot-reconcile-managed-provider' }
    );
  }, 10_000);
};
