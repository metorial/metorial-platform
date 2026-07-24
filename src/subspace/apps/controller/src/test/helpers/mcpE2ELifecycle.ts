import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { startReceiver } from '@metorial-subspace/module-connection';
import { providerDeploymentConfigPairSetSpecificationQueueProcessor } from '@metorial-subspace/module-provider-internal/src/queues/deploymentConfigPair/setSpec';
import { providerDeploymentConfigPairSyncSpecificationQueueProcessor } from '@metorial-subspace/module-provider-internal/src/queues/deploymentConfigPair/syncSpec';
import { providerDeploymentConfigPairVersionCreatedQueueProcessor } from '@metorial-subspace/module-provider-internal/src/queues/lifecycle/deploymentConfigPair';
import { providerVersionSetSpecificationQueueProcessor } from '@metorial-subspace/module-provider-internal/src/queues/version/setSpec';
import { sessionTemplateInvalidateRuntimeQueueProcessor } from '@metorial-subspace/module-session/src/queues/lifecycle/sessionTemplate';
import {
  sessionTemplateProviderCreatedQueueProcessor,
  sessionTemplateSyncHashQueueProcessor
} from '@metorial-subspace/module-session/src/queues/lifecycle/sessionTemplateProvider';
import { cleanDatabase } from '../setup';
import {
  startMcpTestServer,
  stopMcpTestServer,
  type McpTestServerHandle
} from './mcpTestServer';

export let setupMcpE2ELifecycle = () => {
  let serverHandle: McpTestServerHandle | null = null;
  let receiver: ReturnType<typeof startReceiver> | null = null;
  let queueWorkers: { close: () => unknown }[] = [];

  beforeAll(async () => {
    serverHandle = await startMcpTestServer();
  });

  afterAll(async () => {
    if (serverHandle) {
      await stopMcpTestServer(serverHandle);
    }
  }, 60_000);

  beforeEach(async () => {
    await cleanDatabase();

    let workers = await Promise.all(
      [
        providerDeploymentConfigPairVersionCreatedQueueProcessor,
        providerDeploymentConfigPairSyncSpecificationQueueProcessor,
        providerDeploymentConfigPairSetSpecificationQueueProcessor,
        providerVersionSetSpecificationQueueProcessor,
        sessionTemplateProviderCreatedQueueProcessor,
        sessionTemplateSyncHashQueueProcessor,
        sessionTemplateInvalidateRuntimeQueueProcessor
      ].map(processor => processor.start())
    );
    queueWorkers = workers.filter(
      (worker): worker is { close: () => unknown } => worker != null
    );

    receiver = startReceiver();
    await receiver.started;
  });

  afterEach(async () => {
    if (receiver) {
      await receiver.stop();
      receiver = null;
    }

    await Promise.all(queueWorkers.map(worker => worker.close()));
    queueWorkers = [];
  }, 60_000);

  return {
    getRemoteServerBaseUrl: () => {
      if (!serverHandle) throw new Error('MCP test server not initialized');
      return serverHandle.baseUrl;
    }
  };
};
