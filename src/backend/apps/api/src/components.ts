process.env.TZ = 'UTC';

import { apiMux } from '@lowerdeck/api-mux';
import { authApi } from '@metorial/api-auth';
import { startMcpServer } from '@metorial/api-connection';
import { apiServer } from '@metorial/api-core';
import { customPortalApi } from '@metorial/api-custom-portal';
import { fileContentApi, fileUploadApi } from '@metorial/api-files';
import { authenticate } from '@metorial/auth';

let apiPort = parseInt(process.env.API_PORT || '4310');
let filesPort = parseInt(process.env.FILES_PORT || '4318');
let mcpPort = parseInt(process.env.MCP_PORT || '4311');
let oauthPort = parseInt(process.env.OAUTH_PORT || '4313');
let runnerPort = parseInt(process.env.RUNNER_PORT || '3399');
let privateApiPort = parseInt(process.env.PRIVATE_API_PORT || '4314');
let marketplaceApiPort = parseInt(process.env.MARKETPLACE_API_PORT || '4312');
let customPortalApiPort = parseInt(process.env.PORTAL_API_PORT || '4315');
let integrationsApiPort = parseInt(process.env.INTEGRATIONS_API_PORT || '4316');
let callbacksApiPort = parseInt(process.env.CALLBACKS_API_PORT || '4317');

let server = apiMux(
  [
    {
      endpoint: {
        path: '/_/auth',
        fetch: authApi.fetch as any
      }
    },
    {
      methods: ['POST', 'OPTIONS'],
      endpoint: {
        path: '/files',
        exact: true,
        fetch: fileUploadApi.fetch as any
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
  port: filesPort,
  fetch: fileContentApi.fetch
});

Bun.serve({
  port: marketplaceApiPort,
  fetch: marketplaceApp.fetch
});

Bun.serve({
  port: customPortalApiPort,
  fetch: customPortalApi.fetch
});

console.log(
  `Listening on ports ${apiPort} (api), ${filesPort} (files), ${customPortalApiPort} (portals)`
);

if (process.env.AXIOM_TOKEN)
  initLogger({
    token: process.env.AXIOM_TOKEN,
    dataset: 'service-logs'
  });

startPrivateApiServer({ port: privateApiPort });
startMcpServer({ port: mcpPort, authenticate });

if (process.env.NODE_ENV == 'production' && process.env.METORIAL_SOURCE == 'enterprise') {
  Bun.serve({
    fetch: req => new Response('ok'),
    port: 5000
  });
}

console.log(`Listening on ports ${apiPort} (api), ${filesPort} (files)`);
