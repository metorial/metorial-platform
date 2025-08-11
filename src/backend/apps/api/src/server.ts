process.env.TZ = 'UTC';

// import './instrument';

import { authApi } from '@metorial/api-auth';
import { apiServer } from '@metorial/api-core';
import { fileApi } from '@metorial/api-files';
import { marketplaceApp } from '@metorial/api-marketplace';
import { startMcpServer } from '@metorial/api-mcp';
import { apiMux } from '@metorial/api-mux';
import { startRunnerGateway } from '@metorial/api-runner-gateway';
import { authenticate } from '@metorial/auth';
import { createHono } from '@metorial/hono';
import { initLogger } from '@metorial/logging';
import { providerOauthApp } from '@metorial/api-oauth';
import { startPrivateApiServer } from '@metorial/api-private';

let apiPort = parseInt(process.env.API_PORT || '3310');
let mcpPort = parseInt(process.env.MCP_PORT || '3311');
let oauthPort = parseInt(process.env.OAUTH_PORT || '3312');
let runnerPort = parseInt(process.env.RUNNER_PORT || '3399');
let privateApiPort = parseInt(process.env.PRIVATE_API_PORT || '3313');

let server = apiMux(
  [
    {
      endpoint: {
        path: '/_/auth',
        fetch: authApi.fetch as any
      }
    },
    {
      endpoint: {
        path: '/marketplace',
        fetch: createHono().route('/marketplace', marketplaceApp).fetch
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

Bun.serve({
  port: oauthPort,
  fetch: providerOauthApp.fetch
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
startPrivateApiServer({ port: privateApiPort });
