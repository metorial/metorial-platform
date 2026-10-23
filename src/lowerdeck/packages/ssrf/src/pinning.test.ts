import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let fixturePath = join(__dirname, 'pinning.fixture.ts');

// safeFetch relies on Bun's fetch (Host header, tls.serverName), while vitest runs on Node.
let runUnderBun = () =>
  JSON.parse(
    execFileSync(process.versions.bun ? process.execPath : 'bun', [fixturePath], {
      encoding: 'utf-8',
      timeout: 30_000
    })
  );

describe('safeFetch under Bun', () => {
  let results: any;

  beforeAll(() => {
    results = runUnderBun();
  });

  it('cannot reach the test servers without pinning, because the names do not resolve', () => {
    expect(results.unpinned).toMatchObject({ code: 'ENOTFOUND' });
  });

  it('connects to the validated address and keeps the original Host header', () => {
    expect(results.http).toEqual({
      status: 200,
      url: `http://rebind.test:${results.ports.http}/plain`,
      body: { host: `rebind.test:${results.ports.http}`, path: '/plain' },
      lookups: ['rebind.test']
    });
  });

  it('verifies the certificate and sends SNI for the original hostname over https', () => {
    expect(results.https).toEqual({
      status: 200,
      url: `https://rebind.test:${results.ports.https}/secure`,
      body: { host: `rebind.test:${results.ports.https}`, path: '/secure' },
      lookups: ['rebind.test']
    });

    expect(results.httpsWrongName).toMatchObject({
      code: 'ERR_TLS_CERT_ALTNAME_INVALID',
      lookups: ['wrong.test']
    });
  });

  it('resolves, checks and pins every redirect hop', () => {
    expect(results.redirect).toEqual({
      status: 200,
      url: `https://second.test:${results.ports.https}/final`,
      body: { host: `second.test:${results.ports.https}`, path: '/final' },
      lookups: ['rebind.test', 'second.test']
    });

    expect(results.redirectBlocked).toMatchObject({
      error: 'SsrfBlockedError',
      message: 'Private or internal IP blocked',
      lookups: ['rebind.test', 'blocked.test']
    });
  });
});
