import { createInMemoryTransport } from '@metorial/mcp-transport-memory';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ClientCapabilities,
  JSONRPCMessage,
  Notification
} from '@modelcontextprotocol/sdk/types.js';
import z from 'zod';

export interface ClientOpts {
  client: {
    name: string;
    version: string;
  };
  capabilities: ClientCapabilities;
}

export let withClient = async <T>(
  server: McpServer,
  notificationListener: (notification: Notification) => Promise<void>,
  opts: ClientOpts,
  handler: (client: Client) => Promise<T> | T
) => {
  let transport = createInMemoryTransport();
  let client = new Client(opts.client);

  client.registerCapabilities(opts.capabilities);
  client.fallbackNotificationHandler = notificationListener;

  try {
    await server.connect(transport.server);
    await client.connect(transport.client);

    return await handler(client);
  } finally {
    try {
      await client.close();
    } finally {
      await server.close();
    }
  }
};

export let handleMcpMessages = async (
  server: McpServer,
  opts: ClientOpts,
  messages: JSONRPCMessage[]
) => {
  let responses: JSONRPCMessage[] = [];
  let error: Error | null = null;

  await withClient(
    server,
    async notification => {
      responses.push({
        ...notification,
        jsonrpc: '2.0'
      });
    },
    opts,
    async client => {
      for (let message of messages) {
        try {
          if ('id' in message && message.id !== undefined) {
            let res = await client.request(message as any, z.any() as any);
            responses.push({
              id: message.id,
              jsonrpc: '2.0',
              result: res
            });
          } else {
            await client.notification(message as any);
          }
        } catch (err) {
          error = err as Error;
          break;
        }
      }
    }
  );

  return { messages: responses, error };
};
