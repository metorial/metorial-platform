import { retryUntilTimeout } from '@metorial-subspace/retry-utils';
// @ts-ignore
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createFullFeaturedServer } from '../../../../../test-servers/src/servers/full-featured';
import { setupTransports } from '../../../../../test-servers/src/shared/transport';

export type McpTestServerHandle = {
  listener: Server | null;
  port: number | null;
  baseUrl: string;
  mode: 'embedded' | 'external';
};

let waitForBoundAddress = async (
  listener: Server,
  opts: { timeoutMs?: number; pollMs?: number } = {}
): Promise<AddressInfo | null> => {
  return retryUntilTimeout({
    fn: async () => {
      let address = listener.address();
      if (address && typeof address !== 'string') return address;
      return null;
    },
    timeoutMs: opts.timeoutMs ?? 2_000,
    intervalMs: opts.pollMs ?? 20,
    label: 'Waiting for server to bind',
    onTimeout: () => null
  });
};

let startListening = async (app: ReturnType<typeof express>, port: number): Promise<Server> =>
  await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    let server = app.listen(port, () => resolve(server));
    server.once('error', reject);
  });

let normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

export let startMcpTestServer = async (): Promise<McpTestServerHandle> => {
  let externalBaseUrl = process.env.TEST_MCP_SERVER_BASE_URL;
  if (externalBaseUrl) {
    return {
      listener: null,
      port: null,
      baseUrl: normalizeBaseUrl(externalBaseUrl),
      mode: 'external'
    };
  }

  let app = express();

  await setupTransports(app, createFullFeaturedServer, '/full');

  let preferredPort = Number(process.env.TEST_MCP_SERVER_PORT ?? 52198);
  let listener: Server;
  let address: AddressInfo | null = null;
  try {
    listener = await startListening(app, preferredPort);
    address = await waitForBoundAddress(listener);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err;
    listener = await startListening(app, 0);
    address = await waitForBoundAddress(listener);
  }

  if (!address) {
    listener.close();
    listener = await startListening(app, 0);
    address = await waitForBoundAddress(listener);
  }

  if (!address) {
    throw new Error('MCP test server failed to report a bound address');
  }

  let port = address.port;
  // The test server runs on the host machine, but Shuttle (inside Docker) reaches it
  // via host.docker.internal. On Linux, ensure Docker is configured with
  // --add-host=host.docker.internal:host-gateway
  let host = process.env.TEST_MCP_SERVER_HOST ?? 'host.docker.internal';
  let baseUrl = `http://${host}:${port}`;

  return { listener, port, baseUrl, mode: 'embedded' };
};

export let stopMcpTestServer = async (
  handle: McpTestServerHandle,
  opts: { timeoutMs?: number } = {}
) => {
  if (!handle.listener) return;

  let listener = handle.listener as Server & {
    closeAllConnections?: () => void;
    closeIdleConnections?: () => void;
  };

  let timeoutMs = opts.timeoutMs ?? 10_000;

  await new Promise<void>(resolve => {
    let settled = false;
    let finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    let timer = setTimeout(() => {
      finish();
    }, timeoutMs);

    listener.close(() => finish());
    listener.closeIdleConnections?.();
    listener.closeAllConnections?.();
  });
};
