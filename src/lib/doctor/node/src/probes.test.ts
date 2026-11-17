import { createServer, type Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCheckContext } from './check';
import { probes } from './probes';

let ctx = () => createCheckContext(new AbortController().signal, () => undefined).ctx;

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer(socket => socket.end());
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(() => {
  server.close();
});

describe('probes', () => {
  it('connects over tcp', async () => {
    let outcome = await probes.tcp({ host: '127.0.0.1', port })(ctx());
    expect(outcome).toMatchObject({ status: 'pass', details: { host: '127.0.0.1', port } });
  });

  it('throws when nothing listens, so the runner can describe the error', async () => {
    let closed = createServer();
    await new Promise<void>(resolve => closed.listen(0, '127.0.0.1', resolve));
    let closedPort = (closed.address() as { port: number }).port;
    await new Promise(resolve => closed.close(resolve));

    await expect(
      probes.tcp({ host: '127.0.0.1', port: closedPort })(ctx())
    ).rejects.toMatchObject({
      code: 'ECONNREFUSED'
    });
  });

  it('checks http status codes', async () => {
    let fakeFetch = (async (url: string) =>
      new Response(null, { status: url.endsWith('/down') ? 503 : 200 })) as typeof fetch;

    expect(await probes.http({ url: 'http://x/up', fetch: fakeFetch })(ctx())).toMatchObject({
      status: 'pass'
    });
    expect(await probes.http({ url: 'http://x/down', fetch: fakeFetch })(ctx())).toMatchObject(
      {
        status: 'fail',
        message: 'GET http://x/down answered 503.',
        details: { status: 503, kind: 'unavailable' }
      }
    );
  });

  it('warns on slow answers', async () => {
    let outcome = await probes.redis({
      client: { ping: () => new Promise(resolve => setTimeout(() => resolve('PONG'), 15)) },
      warnLatencyMs: 1
    })(ctx());

    expect(outcome).toMatchObject({ status: 'warn', details: { thresholdMs: 1 } });
  });

  it('resolves hostnames', async () => {
    let outcome = await probes.dns({ hostname: 'localhost' })(ctx());
    expect(outcome.status).toBe('pass');
  });
});
