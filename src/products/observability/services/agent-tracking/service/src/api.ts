import { AgentTrackingApi } from '@mtsrc/agent-tracking-api-internal';
import { env } from './env';

let rpcServer = Bun.serve({
  fetch: AgentTrackingApi,
  port: env.listeners.apiPort
});

console.log(`RPC running on http://localhost:${rpcServer.port}`);
