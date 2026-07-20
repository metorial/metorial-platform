import { createRequire } from 'module';

// Provide CommonJS `require` in ESM runtime for bundled deps.
let require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).require = require;

async function main() {
  await import('./init');
  await import('./instrument');

  // Claim both ports before loading the heavy controller / connection graphs.
  // A long import window under `bun --watch` can otherwise race a restart into
  // EADDRINUSE on 52070 or 52072.
  let apiFetch: ((request: Request) => Response | Promise<Response>) | null = null;
  let server = Bun.serve({
    hostname: '0.0.0.0',
    port: 52070,
    fetch: request =>
      apiFetch ? apiFetch(request) : new Response('Starting', { status: 503 })
  });
  console.log(`Service running on http://localhost:${server.port}`);

  let connection:
    | {
        fetch: (request: Request, server: any) => Response | Promise<Response>;
        websocket: {
          open?: (ws: any) => void;
          message?: (ws: any, message: any) => void;
          close?: (ws: any, code?: number, reason?: string) => void;
          drain?: (ws: any) => void;
          error?: (ws: any, error: Error) => void;
        };
      }
    | null = null;

  Bun.serve({
    hostname: '0.0.0.0',
    port: 52072,
    idleTimeout: 0,
    fetch: (request, bunServer) =>
      connection
        ? connection.fetch(request, bunServer)
        : new Response('Starting', { status: 503 }),
    websocket: {
      open: ws => connection?.websocket.open?.(ws),
      message: (ws, message) => connection?.websocket.message?.(ws, message),
      close: (ws, code, reason) => connection?.websocket.close?.(ws, code, reason),
      drain: ws => connection?.websocket.drain?.(ws),
      error: (ws, error) => connection?.websocket.error?.(ws, error)
    }
  });
  console.log('Connection service running on http://localhost:52072');

  let [{ startControllerApi }, { startConnectionServer }] = await Promise.all([
    import('./endpoints'),
    import('./connection/server')
  ]);
  let [api, startedConnection] = await Promise.all([
    startControllerApi(),
    startConnectionServer()
  ]);
  apiFetch = api;
  connection = startedConnection;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

if (process.env.HEARTBEAT_URL) {
  let captureHeartbeatError = async (error: unknown) => {
    try {
      let { getSentry } = await import('@lowerdeck/sentry');
      getSentry().captureException(error);
    } catch {}

    console.error('Failed to send heartbeat:', error);
  };

  let sendHeartbeat = async () => {
    try {
      let { checkConduitHeartbeat, checkNatsHealth } =
        await import('@metorial-subspace/module-connection/src/health');

      await checkNatsHealth();
      await checkConduitHeartbeat({ failOnEmptyFleet: true });
      await fetch(process.env.HEARTBEAT_URL!, { method: 'POST' });
    } catch (error) {
      await captureHeartbeatError(error);
    }
  };

  setInterval(() => {
    void sendHeartbeat();
  }, 45 * 1000); // Send heartbeat every 45 seconds
}
