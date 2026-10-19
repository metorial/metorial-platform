import { runQueueProcessors } from '@lowerdeck/queue';
import { agentSubspaceQueueProcessor } from '@metorial-subspace/module-agent/src/queues';
import { authSubspaceQueueProcessor } from '@metorial-subspace/module-auth/src/queues';
import { callbackSubspaceQueueProcessor } from '@metorial-subspace/module-callback/src/queues';
import { catalogSubspaceQueueProcessor } from '@metorial-subspace/module-catalog/src/queues';
import { connectionSubspaceQueueProcessor } from '@metorial-subspace/module-connection/src/queueProcessor';
import { customProviderSubspaceQueueProcessor } from '@metorial-subspace/module-custom-provider/src/queues';
import { deploymentSubspaceQueueProcessor } from '@metorial-subspace/module-deployment/src/queues';
import { enclaveSubspaceQueueProcessor } from '@metorial-subspace/module-enclave/src/queues';
import { identitySubspaceQueueProcessor } from '@metorial-subspace/module-identity/src/queues';
import { integrationSubspaceQueueProcessor } from '@metorial-subspace/module-integration/src/queues';
import { chatSubspaceQueueProcessor } from '@metorial-subspace/module-chat/src/queues';
import { monitorSubspaceQueueProcessor } from '@metorial-subspace/module-monitor/src/queues';
import { syncProtoGuardFilters } from '@metorial-subspace/module-connection/src/protoguard/registry';
import { providerInternalSubspaceQueueProcessor } from '@metorial-subspace/module-provider-internal/src/queues';
import { publicMcpSubspaceQueueProcessor } from '@metorial-subspace/module-public-mcp/src/queues';
import { sessionSubspaceQueueProcessor } from '@metorial-subspace/module-session/src/queues';
import { tenantSubspaceQueueProcessors } from '@metorial-subspace/module-tenant/src/queues';
import { nativeProviderSubspaceQueues } from '@metorial-subspace/provider-native';
import { shuttleProviderSubspaceQueues } from '@metorial-subspace/provider-shuttle';
import { slatesProviderSubspaceQueues } from '@metorial-subspace/provider-slates';

setTimeout(async () => {
  await syncProtoGuardFilters();
}, 10_000);

runQueueProcessors([
  sessionSubspaceQueueProcessor,
  connectionSubspaceQueueProcessor,
  authSubspaceQueueProcessor,
  catalogSubspaceQueueProcessor,
  deploymentSubspaceQueueProcessor,
  enclaveSubspaceQueueProcessor,
  tenantSubspaceQueueProcessors,
  providerInternalSubspaceQueueProcessor,
  nativeProviderSubspaceQueues,
  slatesProviderSubspaceQueues,
  shuttleProviderSubspaceQueues,
  customProviderSubspaceQueueProcessor,
  callbackSubspaceQueueProcessor,
  identitySubspaceQueueProcessor,
  integrationSubspaceQueueProcessor,
  chatSubspaceQueueProcessor,
  monitorSubspaceQueueProcessor,
  agentSubspaceQueueProcessor,
  publicMcpSubspaceQueueProcessor
]);
