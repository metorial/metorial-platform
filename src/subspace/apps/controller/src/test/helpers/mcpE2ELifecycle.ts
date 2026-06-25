import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { startReceiver } from '@metorial-subspace/module-connection';
import { cleanDatabase } from '../setup';
import {
  startMcpTestServer,
  stopMcpTestServer,
  type McpTestServerHandle
} from './mcpTestServer';

export let setupMcpE2ELifecycle = () => {
  let serverHandle: McpTestServerHandle | null = null;
  let receiver: ReturnType<typeof startReceiver> | null = null;

  beforeAll(async () => {
    serverHandle = await startMcpTestServer();
  });

  afterAll(
    async () => {
      if (serverHandle) {
        await stopMcpTestServer(serverHandle);
      }
    },
    60_000
  );

  beforeEach(async () => {
    await cleanDatabase();
    receiver = startReceiver();
    await receiver.started;
  });

  afterEach(
    async () => {
      if (receiver) {
        await receiver.stop();
        receiver = null;
      }
    },
    60_000
  );

  return {
    getRemoteServerBaseUrl: () => {
      if (!serverHandle) throw new Error('MCP test server not initialized');
      return serverHandle.baseUrl;
    }
  };
};
