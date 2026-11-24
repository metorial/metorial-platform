import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

let bodies: string[] = [];
let server: Server;

let readBody = async (request: IncomingMessage) => {
  let chunks: Buffer[] = [];
  for await (let chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

let events = () =>
  bodies
    .map(body =>
      body
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
    )
    .filter(items => items[1]?.type === 'event')
    .map(items => items[2]);

beforeAll(async () => {
  server = createServer(async (request, response) => {
    bodies.push(await readBody(request));
    response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  let { port } = server.address() as AddressInfo;
  process.env.ERROR_REPORTING_DSN = `http://integration-controller@127.0.0.1:${port}/1`;
  process.env.METORIAL_EDITION = 'on-prem';

  let { initErrorReporting } = await import('./index');
  initErrorReporting();
});

afterEach(() => {
  process.env.METORIAL_EDITION = 'on-prem';
  bodies = [];
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

let flush = async () => {
  let { getSentry } = await import('@lowerdeck/sentry');
  await getSentry().flush(2_000);
};

describe('reportFailure', () => {
  it('sends the failure with its tags, details and log tail', async () => {
    let { reportFailure } = await import('./failure');

    expect(
      reportFailure({
        type: 'IntegrationDeploymentFailed',
        fingerprint: ['integration-deployment-failed', 'github', 'build_failed'],
        message: 'GitHub 1.2.0 failed to deploy: exit code 1 (deployment sdp_1)',
        tags: { integration: 'github', error_code: 'build_failed', step: undefined },
        details: { version: '1.2.0', duration_ms: 5400, empty: '', missing: undefined },
        log: [
          ...Array.from({ length: 60 }, (_, index) => `line ${index}`),
          '\u001b[31mnpm ERR!\u001b[0m code E404',
          '   '
        ]
      })
    ).toBe(true);
    await flush();

    let [event] = events();
    expect(event.level).toBe('error');
    expect(event.fingerprint).toEqual([
      'integration-deployment-failed',
      'github',
      'build_failed'
    ]);
    expect(event.tags).toMatchObject({ integration: 'github', error_code: 'build_failed' });
    expect(event.tags.step).toBeUndefined();
    expect(event.exception.values[0]).toMatchObject({
      type: 'IntegrationDeploymentFailed',
      value: 'GitHub 1.2.0 failed to deploy: exit code 1 (deployment sdp_1)'
    });
    expect(event.contexts.details).toEqual({ version: '1.2.0', duration_ms: 5400 });
    expect(event.contexts.log.lines).toHaveLength(40);
    expect(event.contexts.log.lines.at(-1)).toBe('npm ERR! code E404');
  });

  it('keeps the type and stack trace of an exception', async () => {
    let { reportFailure } = await import('./failure');

    reportFailure({
      type: 'IntegrationServerError',
      fingerprint: ['integration-server-error', 'github', 'invocation_exception'],
      message: 'unused',
      error: new TypeError('fetch failed'),
      tags: { integration: 'github' },
      details: { reason: 'invocation_exception' }
    });
    await flush();

    let [event] = events();
    expect(event.exception.values[0].type).toBe('TypeError');
    expect(event.exception.values[0].stacktrace.frames.length).toBeGreaterThan(0);
    expect(event.fingerprint).toEqual([
      'integration-server-error',
      'github',
      'invocation_exception'
    ]);
    expect(event.tags.integration).toBe('github');
    expect(event.contexts.details).toEqual({ reason: 'invocation_exception' });
  });

  it('sends a hyphenated component key in the form Sentry accepts', async () => {
    let { normalizeDsnKey } = await import('./index');

    expect(normalizeDsnKey('http://integration-controller@error-collector:8095/1')).toBe(
      'http://integration_controller@error-collector:8095/1'
    );
  });

  it('reports nothing outside the on-prem edition', async () => {
    let { reportFailure } = await import('./failure');
    process.env.METORIAL_EDITION = 'cloud';

    expect(
      reportFailure({ type: 'BuildFailed', fingerprint: ['build-failed'], message: 'x' })
    ).toBe(false);
    await flush();

    expect(events()).toEqual([]);
  });
});
