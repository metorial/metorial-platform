import {
  createServerRunnerGateway,
  serverRunnerService
} from '@metorial/module-server-runner';
import type { ServerWebSocket } from 'bun';
import { createBunWebSocket } from 'hono/bun';

export let startRunnerGateway = (d: { port: number }) => {
  let { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

  let hono = createServerRunnerGateway(upgradeWebSocket);

  Bun.serve({
    port: d.port,
    fetch: hono.fetch,
    websocket
  });

  console.log('Server runner gateway started on port', d.port);

  if (process.env.METORIAL_SOURCE != 'enterprise') {
    serverRunnerService
      .ensureHostedServerRunner({
        identifier: 'default',
        name: 'Default Server Runner',
        description: 'Default server runner for Metorial',
        attributes: []
      })
      .then(runner => {
        let uri = `mti://${runner.connectionKey}@localhost:${d.port}/${runner.id}`;

        console.log(`Please use the following URL for your server runner ${uri}`);
      });
  }
};
