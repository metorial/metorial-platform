export let serverTs = `import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ClientCapabilities, Notification } from '@modelcontextprotocol/sdk/types.js';
import { ProgrammablePromise } from './promise.ts';
import { DeploymentError } from './error.ts';
import { delay } from './delay.ts';
import { createInProcessTransport } from './transport.ts';

interface BootOptions {
  client: {
    name: string;
    version: string;
  };
  capabilities: ClientCapabilities;
  notificationListener: (notification: Notification) => void;
}

let clients = new Map<string, Promise<Client>>();

export let getClient = async (args: any, opts: BootOptions) => {
  if (clients.has(opts.client.name)) {
    return clients.get(opts.client.name)!;
  }

  let client = (async () => {
    let server = await Promise.race([
      globalThis.__metorial_getServer__(),
      delay(100).then(() => {
        throw new DeploymentError({
          code: 'server_start_timeout',
          message: 'MCP server did not start within 100ms',
          publicMessage: 'MCP server did not start within 100ms'
        });
      })
    ]);

    globalThis.__metorial_setArgs__(args);
    if (server.type == 'metorial.server::v1') {
      server = await server.start(args);
    }

    let transport = createInProcessTransport();
    await server.connect(transport.server);

    let client = new Client({
      name: opts.client.name,
      version: opts.client.version
    });

    client.registerCapabilities(opts.capabilities);
    client.fallbackNotificationHandler = opts.notificationListener;

    await client.connect(transport.client);

    return client;
  })()

  clients.set(opts.client.name, client);

  return client;
};
`;
