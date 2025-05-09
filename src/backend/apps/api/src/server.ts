process.env.TZ = 'UTC';

// import './instrument';

import { apiMux } from '@metorial/api-mux';
import { initLogger } from '@metorial/logging';
import { apiServer } from './apiServer';
import { authApi } from './auth';

let port = parseInt(process.env.PORT || '3310');

let server = apiMux(
  [
    {
      endpoint: {
        path: '/_/auth',
        fetch: authApi.fetch as any
      }
    }
  ],
  apiServer.fetch
);

Bun.serve({
  port,
  fetch: server
});

console.log(`Listening on port ${port}`);

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
