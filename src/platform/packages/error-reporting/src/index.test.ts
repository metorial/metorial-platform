import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type ReceivedRequest = { url: string; body: string };

let received: ReceivedRequest[] = [];
let server: Server;

let readBody = async (request: IncomingMessage) => {
  let chunks: Buffer[] = [];
  for await (let chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

let envelopeItems = (body: string) =>
  body
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));

beforeAll(async () => {
  server = createServer(async (request, response) => {
    received.push({
      url: request.url ?? '',
      body: await readBody(request)
    });
    response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  let { port } = server.address() as AddressInfo;
  process.env.ERROR_REPORTING_DSN = `http://worker@127.0.0.1:${port}/1`;
  process.env.METORIAL_VERSION = '2026.11.1';
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

describe('initErrorReporting', () => {
  it('sends events to the collector named by the DSN', async () => {
    let { initErrorReporting, reportBootFailure } = await import('./index');
    let { getSentry } = await import('@lowerdeck/sentry');

    expect(initErrorReporting()).toBe(true);
    expect(initErrorReporting()).toBe(false);

    getSentry().captureException(new Error('job failed'));
    getSentry().captureException(
      Object.assign(new Error('[@lowerdeck/error]: not found'), {
        status: 404,
        code: 'not_found'
      })
    );
    await reportBootFailure(new Error('database unreachable'), 'hyperplane');

    let events = received
      .map(request => envelopeItems(request.body))
      .filter(items => items[1]?.type === 'event')
      .map(items => items[2]);

    expect(received.every(request => request.url.startsWith('/api/1/envelope/'))).toBe(true);
    expect(received.every(request => request.url.includes('sentry_key=worker'))).toBe(true);
    expect(events.map(event => event.exception.values[0].value)).toEqual([
      'job failed',
      'database unreachable'
    ]);
    expect(events[0].release).toBe('2026.11.1');
    expect(events[0].exception.values[0].stacktrace.frames.length).toBeGreaterThan(0);
    expect(events[1].tags.boot_step).toBe('hyperplane');
    expect(events[1].exception.values[0].mechanism).toMatchObject({
      type: 'boot',
      handled: false
    });
  });
});
