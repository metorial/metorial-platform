import { replayLines } from './logs';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hub } from './hub';
import { allowedHosts, paths, uiPort } from './home';
import { buildId } from './build';
import { jobKinds, type JobKind } from './types';

class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

interface Terminal {
  workspace: string;
  unit?: string;
  proc?: ReturnType<typeof Bun.spawn>;
}

let json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });

let sse = (setup: (send: (value: unknown) => void) => () => void) => {
  let cleanup = () => {};
  let heartbeat: ReturnType<typeof setInterval>;
  let body = new ReadableStream({
    start(controller) {
      let encoder = new TextEncoder();
      let send = (value: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
        } catch {}
      };
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {}
      }, 5_000);
      cleanup = setup(send);
    },
    cancel() {
      clearInterval(heartbeat);
      cleanup();
    }
  });

  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    }
  });
};

export let startServer = async () => {
  let location = paths();
  let hub = new Hub();
  await hub.load();
  process.setMaxListeners(0);

  let allowed = allowedHosts(uiPort());
  let id = buildId();

  let body = async (request: Request) =>
    request.method === 'GET' ? {} : ((await request.json().catch(() => ({}))) ?? {});

  let route = async (request: Request, server: Bun.Server<Terminal>, remote: boolean) => {
    let url = new URL(request.url);
    let path = url.pathname;
    let method = request.method;

    if (remote) {
      let address = server.requestIP(request)?.address ?? '';
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address))
        throw new HttpError(403, 'loopback only');
      if (!allowed.has(request.headers.get('host') ?? ''))
        throw new HttpError(403, 'bad host');
      let origin = request.headers.get('origin');
      if (origin && !allowed.has(new URL(origin).host)) throw new HttpError(403, 'bad origin');
    }

    if (method === 'GET' && (path === '/' || path === '/index.html'))
      return new Response(readFileSync(join(import.meta.dir, 'ui/index.html')), {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });

    if (path === '/api/ping')
      return json({ pid: process.pid, build: id, startedAt: hub.startedAt, port: uiPort() });

    if (path === '/api/workspaces' && method === 'GET')
      return json(hub.list().map(runtime => runtime.info()));

    if (path === '/api/workspaces/register' && method === 'POST') {
      let { root } = (await body(request)) as { root: string };

      return json((await hub.register(root)).info());
    }

    if (path === '/api/events')
      return sse(send => {
        for (let runtime of hub.list()) send(runtime.info());

        return hub.subscribe(send);
      });

    if (path === '/api/shutdown' && method === 'POST') {
      setTimeout(() => shutdown(), 50);

      return json({ ok: true });
    }

    if (path === '/ws/terminal') {
      let upgraded = server.upgrade(request, {
        data: {
          workspace: url.searchParams.get('workspace') ?? '',
          unit: url.searchParams.get('unit') ?? undefined
        }
      });

      return upgraded ? undefined : new Response('upgrade failed', { status: 400 });
    }

    let match = path.match(/^\/api\/workspaces\/([^/]+)(?:\/(.*))?$/);
    if (!match) throw new HttpError(404, 'not found');
    let runtime = hub.get(decodeURIComponent(match[1]!));
    let rest = match[2] ?? '';
    let payload = (await body(request)) as Record<string, any>;

    if (rest === '' && method === 'GET') return json(runtime.info());

    if (rest === 'start') {
      if (!runtime.startable) throw new HttpError(409, `workspace is ${runtime.phase}`);
      runtime.start(payload).catch(() => {});

      return json(runtime.info(), 202);
    }

    if (rest === 'stop') {
      runtime.stop(payload).catch(() => {});

      return json(runtime.info(), 202);
    }

    if (rest === 'restart') {
      runtime.restartWorkspace(payload).catch(() => {});

      return json(runtime.info(), 202);
    }

    let unit = rest.match(/^units\/([^/]+)\/(restart|stop|start)$/);
    if (unit && method === 'POST') {
      let name = decodeURIComponent(unit[1]!);
      let action = {
        restart: () => runtime.restartUnit(name),
        stop: () => runtime.stopServiceUnit(name),
        start: () => runtime.startServiceUnit(name)
      }[unit[2] as 'restart'];
      await action();

      return json(runtime.info());
    }

    if (rest === 'jobs' && method === 'POST') {
      if (!jobKinds.includes(payload.kind)) throw new HttpError(400, 'unknown job kind');

      return json(runtime.runJob(payload.kind as JobKind, payload.selectors ?? []), 202);
    }

    if (rest === 'logs') {
      let units = url.searchParams.get('units')?.split(',').filter(Boolean);
      let tail = url.searchParams.has('tail')
        ? Number(url.searchParams.get('tail'))
        : replayLines;
      let since = url.searchParams.has('since')
        ? Number(url.searchParams.get('since'))
        : undefined;

      if (url.searchParams.get('follow') !== '1')
        return json(
          runtime.logs.query({ units, tail: since === undefined ? tail : undefined, since })
        );

      return sse(send => {
        let last = 0;
        for (let line of runtime.logs.query({ units, tail, since })) {
          send(line);
          last = line.seq;
        }

        return runtime.logs.subscribe(line => {
          if (line.seq > last && (!units?.length || units.includes(line.unit))) send(line);
        });
      });
    }

    throw new HttpError(404, 'not found');
  };

  let handler =
    (remote: boolean) => async (request: Request, server: Bun.Server<Terminal>) => {
      server.timeout(request, 0);

      try {
        return await route(request, server, remote);
      } catch (error) {
        if (error instanceof HttpError) return json({ error: error.message }, error.status);

        return json({ error: error instanceof Error ? error.message : String(error) }, 500);
      }
    };

  let websocket: Bun.WebSocketHandler<Terminal> = {
    open(ws) {
      try {
        let runtime = hub.get(ws.data.workspace);
        let { cwd, env } = runtime.shellContext(ws.data.unit);
        ws.data.proc = Bun.spawn([process.env.SHELL || '/bin/zsh', '-i'], {
          cwd,
          env: { ...process.env, ...env, TERM: 'xterm-256color' },
          terminal: { cols: 100, rows: 30, data: (_terminal, data) => ws.send(data) }
        });
        ws.data.proc.exited.then(() => ws.close());
      } catch (error) {
        ws.send(`\r\n${error instanceof Error ? error.message : error}\r\n`);
        ws.close();
      }
    },
    message(ws, message) {
      let proc = ws.data.proc as any;
      if (!proc?.terminal) return;
      let parsed = JSON.parse(String(message));

      if (parsed.type === 'input') proc.terminal.write(parsed.data);
      else if (parsed.type === 'resize') proc.terminal.resize(parsed.cols, parsed.rows);
    },
    close(ws) {
      ws.data.proc?.kill();
    }
  };

  rmSync(location.socket, { force: true });
  let unixServer = Bun.serve<Terminal>({
    unix: location.socket,
    fetch: handler(false),
    websocket
  });
  let listen = (hostname: string) =>
    Bun.serve<Terminal>({
      port: uiPort(),
      hostname,
      fetch: handler(true),
      websocket,
      idleTimeout: 0
    });
  // macOS only lets unprivileged processes bind ports below 1024 on the wildcard
  // address; the request guard above keeps the UI loopback-only either way.
  let webServer: ReturnType<typeof listen>;
  try {
    webServer = listen('127.0.0.1');
  } catch {
    try {
      webServer = listen('0.0.0.0');
    } catch (error) {
      unixServer.stop(true);
      rmSync(location.socket, { force: true });
      console.error(`could not listen on port ${uiPort()}: ${error}`);
      process.exit(1);
    }
  }
  writeFileSync(location.pid, String(process.pid));

  let stopping = false;
  let shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await hub.shutdown();
    unixServer.stop(true);
    webServer.stop(true);
    rmSync(location.socket, { force: true });
    rmSync(location.pid, { force: true });
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  console.log(
    `control daemon ${process.pid} listening on ${location.socket} and :${uiPort()}`
  );
};
