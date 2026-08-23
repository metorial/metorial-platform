import { runQueueProcessors } from '@lowerdeck/queue';
import { agentQueueProcessor } from '@metorial-subspace/module-agent/src/queues';
import {
  authQueueProcessor,
  reconcileManagedCredentialProviderManyQueue
} from '@metorial-subspace/module-auth/src/queues';
import { callbackQueueProcessor } from '@metorial-subspace/module-callback/src/queues';
import { catalogQueueProcessor } from '@metorial-subspace/module-catalog/src/queues';
import { connectionQueueProcessor } from '@metorial-subspace/module-connection/src/queueProcessor';
import { customProviderQueueProcessor } from '@metorial-subspace/module-custom-provider/src/queues';
import { deploymentQueueProcessor } from '@metorial-subspace/module-deployment/src/queues';
import { enclaveQueueProcessor } from '@metorial-subspace/module-enclave/src/queues';
import { identityQueueProcessor } from '@metorial-subspace/module-identity/src/queues';
import { integrationQueueProcessor } from '@metorial-subspace/module-integration/src/queues';
import { monitorQueueProcessor } from '@metorial-subspace/module-monitor/src/queues';
import { syncProtoGuardFilters } from '@metorial-subspace/module-connection/src/protoguard/registry';
import { providerInternalQueueProcessor } from '@metorial-subspace/module-provider-internal/src/queues';
import { sessionQueueProcessor } from '@metorial-subspace/module-session/src/queues';
import { tenantQueueProcessors } from '@metorial-subspace/module-tenant/src/queues';
import { nativeProviderQueues } from '@metorial-subspace/provider-native';
import { shuttleProviderQueues } from '@metorial-subspace/provider-shuttle';
import { slatesProviderQueues } from '@metorial-subspace/provider-slates';

setTimeout(async () => {
  await syncProtoGuardFilters();
}, 10_000);

runQueueProcessors([
  sessionQueueProcessor,
  connectionQueueProcessor,
  authQueueProcessor,
  catalogQueueProcessor,
  deploymentQueueProcessor,
  enclaveQueueProcessor,
  tenantQueueProcessors,
  providerInternalQueueProcessor,
  nativeProviderQueues,
  slatesProviderQueues,
  shuttleProviderQueues,
  customProviderQueueProcessor,
  callbackQueueProcessor,
  identityQueueProcessor,
  integrationQueueProcessor,
  monitorQueueProcessor,
  agentQueueProcessor
]);

setTimeout(() => {
  reconcileManagedCredentialProviderManyQueue.add(
    {},
    { id: 'boot-reconcile-managed-provider' }
  );
}, 10_000);
