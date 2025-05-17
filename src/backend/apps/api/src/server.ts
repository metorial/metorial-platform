process.env.TZ = 'UTC';

// import './instrument';

import { authApi } from '@metorial/api-auth';
import { apiServer } from '@metorial/api-core';
import { fileApi } from '@metorial/api-files';
import { startMcpServer } from '@metorial/api-mcp';
import { apiMux } from '@metorial/api-mux';
import { startRunnerGateway } from '@metorial/api-runner-gateway';
import { authenticate } from '@metorial/auth';
import { initLogger } from '@metorial/logging';

let apiPort = parseInt(process.env.PORT || '3310');
let mcpPort = parseInt(process.env.PORT || '3311');
let runnerPort = parseInt(process.env.PORT || '3399');

let server = apiMux(
  [
    {
      endpoint: {
        path: '/_/auth',
        fetch: authApi.fetch as any
      }
    },
    {
      methods: ['POST'],
      endpoint: {
        path: '/files',
        fetch: fileApi.fetch as any
      }
    }
  ],
  apiServer.fetch
);

Bun.serve({
  port: apiPort,
  fetch: server
});

console.log(`Listening on port ${apiPort}`);

if (process.env.AXIOM_TOKEN)
  initLogger({
    token: process.env.AXIOM_TOKEN,
    dataset: 'service-logs'
  });

if (process.env.NODE_ENV == 'production') {
  Bun.serve({
    fetch: req => new Response('ok'),
    port: 5000
  });
}

startRunnerGateway({ port: runnerPort });
startMcpServer({ port: mcpPort, authenticate });
