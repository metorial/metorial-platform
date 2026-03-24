import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { FetchFn } from './honoFetchAdapter';

export type McpTestClient = {
  client: Client;
  transport: SSEClientTransport | StreamableHTTPClientTransport;
  connect: () => Promise<void>;
  cleanup: () => Promise<void>;
};

export let createMcpTestClient = (opts: {
  baseUrl: string;
  transportType: 'sse' | 'streamable_http';
  fetch: FetchFn;
}): McpTestClient => {
  let url = new URL(opts.baseUrl);

  let transport =
    opts.transportType === 'streamable_http'
      ? new StreamableHTTPClientTransport(url, {
          fetch: opts.fetch
        })
      : new SSEClientTransport(url, {
          fetch: opts.fetch,
          eventSourceInit: {
            fetch: opts.fetch
          }
        });

  let client = new Client({
    name: 'subspace-e2e',
    version: '1.0.0'
  });

  let connect = async () => {
    await client.connect(transport);
  };

  let cleanup = async () => {
    if (transport instanceof StreamableHTTPClientTransport) {
      await transport.terminateSession().catch(err => {
        console.warn(
          `Failed to terminate MCP streamable_http session during cleanup: ${
            (err as Error)?.message ?? String(err)
          }`
        );
      });
    }
    await client.close();
  };

  return { client, transport, connect, cleanup };
};
