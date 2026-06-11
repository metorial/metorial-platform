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
  headers?: Record<string, string>;
}): McpTestClient => {
  let url = new URL(opts.baseUrl);
  let fetch: FetchFn = async (input, init) => {
    let headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (opts.headers) {
      new Headers(opts.headers).forEach((value, key) => headers.set(key, value));
    }
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (input instanceof Request) {
      return await opts.fetch(new Request(input, { ...init, headers }));
    }

    return await opts.fetch(input, { ...init, headers });
  };

  let transport =
    opts.transportType === 'streamable_http'
      ? new StreamableHTTPClientTransport(url, {
          fetch
        })
      : new SSEClientTransport(url, {
          fetch,
          eventSourceInit: {
            fetch
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
