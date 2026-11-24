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

    expect(outcome).toMatchObject({
      status: 'warn',
      message: expect.stringContaining('(fastest of 3 attempts)'),
      details: {
        thresholdMs: 1,
        attemptsMs: [expect.any(Number), expect.any(Number), expect.any(Number)]
      }
    });
  });

  it('retries a slow answer and passes when a later attempt is fast', async () => {
    let queries = 0;
    let outcome = await probes.sql({
      query: () => new Promise(resolve => setTimeout(resolve, queries++ == 0 ? 60 : 0)),
      warnLatencyMs: 30
    })(ctx());

    expect(queries).toBe(2);
    expect(outcome.status).toBe('pass');
    expect(outcome.details?.latencyMs).toBeLessThan(30);
    expect(outcome.details?.attemptsMs).toHaveLength(2);
  });

  it('measures a fast answer only once', async () => {
    let queries = 0;
    let outcome = await probes.sql({
      query: async () => {
        queries++;
      }
    })(ctx());

    expect(queries).toBe(1);
    expect(outcome).toMatchObject({
      status: 'pass',
      message: expect.not.stringContaining('attempts')
    });
    expect(outcome.details).not.toHaveProperty('attemptsMs');
  });

  it('stops retrying once the check is aborted', async () => {
    let controller = new AbortController();
    let { ctx: abortingCtx } = createCheckContext(controller.signal, () => undefined);
    let queries = 0;

    let outcome = await probes.sql({
      query: () =>
        new Promise(resolve =>
          setTimeout(() => {
            queries++;
            controller.abort(new Error('timed out'));
            resolve(undefined);
          }, 5)
        ),
      warnLatencyMs: 0
    })(abortingCtx);

    expect(queries).toBe(1);
    expect(outcome.status).toBe('warn');
  });

  it('does not count connection setup against the redis latency threshold', async () => {
    let pings = 0;
    let outcome = await probes.redis({
      client: {
        ping: () =>
          new Promise(resolve => setTimeout(() => resolve('PONG'), pings++ == 0 ? 80 : 0))
      },
      warnLatencyMs: 40
    })(ctx());

    expect(pings).toBe(2);
    expect(outcome).toMatchObject({ status: 'pass' });
    expect(outcome.details?.connectMs).toBeGreaterThanOrEqual(40);
    expect(outcome.details?.latencyMs).toBeLessThan(40);
  });

  it('resolves hostnames', async () => {
    let outcome = await probes.dns({ hostname: 'localhost' })(ctx());
    expect(outcome.status).toBe('pass');
  });

  it('stops waiting for a hostname once the check is aborted', async () => {
    let controller = new AbortController();
    let { ctx: abortedCtx } = createCheckContext(controller.signal, () => undefined);
    controller.abort(new Error('timed out'));

    await expect(probes.dns({ hostname: 'localhost' })(abortedCtx)).rejects.toThrow(
      'timed out'
    );
  });
});
