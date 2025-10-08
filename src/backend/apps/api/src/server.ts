process.env.TZ = 'UTC';

import { authApi } from '@metorial/api-auth';
import { apiServer } from '@metorial/api-core';
import { fileApi } from '@metorial/api-files';
import { marketplaceApp } from '@metorial/api-marketplace';
import { startMcpServer } from '@metorial/api-mcp';
import { apiMux } from '@metorial/api-mux';
import { providerOauthApp } from '@metorial/api-oauth';
import { portalApp } from '@metorial/api-portal';
import { startPrivateApiServer } from '@metorial/api-private';
import { startRunnerGateway } from '@metorial/api-runner-gateway';
import { authenticate } from '@metorial/auth';
import { initLogger } from '@metorial/logging';

import './worker';

let apiPort = parseInt(process.env.API_PORT || '4310');
let mcpPort = parseInt(process.env.MCP_PORT || '4311');
let oauthPort = parseInt(process.env.OAUTH_PORT || '4313');
let portalPort = parseInt(process.env.PORTAL_PORT || '4315');
let runnerPort = parseInt(process.env.RUNNER_PORT || '3399');
let privateApiPort = parseInt(process.env.PRIVATE_API_PORT || '4314');
let marketplaceApiPort = parseInt(process.env.MARKETPLACE_API_PORT || '4312');

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

Bun.serve({
  port: oauthPort,
  fetch: providerOauthApp.fetch
});

Bun.serve({
  port: marketplaceApiPort,
  fetch: marketplaceApp.fetch
});

Bun.serve({
  port: portalPort,
  fetch: portalApp.fetch
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
