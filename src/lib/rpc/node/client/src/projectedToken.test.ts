import { internalServerError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import { mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { projectedTokenHeaders } from './projectedToken';
import { clientBuilder } from './shared/clientBuilder';

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn(), getTraceData: vi.fn() }),
  markSentryCaptured: vi.fn()
}));

let dir: string;
let tokenPath: string;

let writeToken = async (token: string, opts: { keepMtime?: boolean } = {}) => {
  let before = opts.keepMtime ? await stat(tokenPath) : undefined;
  await writeFile(tokenPath, token);
  if (before) await utimes(tokenPath, before.atime, before.mtime);
  else {
    let next = new Date(Date.now() + Math.random() * 1_000_000);
    await utimes(tokenPath, next, next);
  }
};

type Api = {
  fn: {
    call: (input: {}) => Promise<{ ok: boolean }>;
    create: (input: {}) => Promise<{ ok: boolean }>;
  };
};

describe('projectedTokenHeaders', () => {
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rpc-client-token-'));
    tokenPath = join(dir, 'token');
    await writeToken('first\n');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('reads the token and re-reads it only when the mtime changes', async () => {
    let headers = projectedTokenHeaders(tokenPath);
    expect(await headers()).toEqual({ authorization: 'Bearer first' });

    await writeToken('unseen', { keepMtime: true });
    expect(await headers()).toEqual({ authorization: 'Bearer first' });

    await writeToken('second');
    expect(await headers()).toEqual({ authorization: 'Bearer second' });
  });

  test('rejects empty and missing token files', async () => {
    await writeToken('  \n');
    await expect(projectedTokenHeaders(tokenPath)()).rejects.toThrow('is empty');
    await expect(projectedTokenHeaders(join(dir, 'missing'))()).rejects.toThrow();
  });

  test('onUnauthorized retries only when the file holds a different token', async () => {
    let headers = projectedTokenHeaders(tokenPath);
    await headers();

    expect(await headers.onUnauthorized!()).toBe(false);

    await writeToken('rotated', { keepMtime: true });
    expect(await headers.onUnauthorized!()).toBe(true);
    expect(await headers()).toEqual({ authorization: 'Bearer rotated' });
  });

  test('a client re-reads the token once after a 401', async () => {
    let seen: string[] = [];
    let request = vi.fn(async (call: any) => {
      seen.push(call.headers.authorization);
      if (call.headers.authorization != 'Bearer rotated')
        throw new ServiceError(unauthorizedError());
      return { data: { ok: true }, status: 200, headers: {} };
    });
    let client = clientBuilder(request)<Api>({
      endpoint: 'http://localhost/rpc',
      getHeaders: projectedTokenHeaders(tokenPath)
    });

    await expect(client.fn.call({})).rejects.toMatchObject({ data: { status: 401 } });
    expect(seen).toEqual(['Bearer first']);

    await writeToken('rotated', { keepMtime: true });
    await expect(client.fn.call({})).resolves.toEqual({ ok: true });
    expect(seen).toEqual(['Bearer first', 'Bearer first', 'Bearer rotated']);
  });

  test('a client does not retry other errors through onUnauthorized', async () => {
    let onUnauthorized = vi.fn(() => true);
    let request = vi.fn(async () => {
      throw new ServiceError(internalServerError());
    });
    let client = clientBuilder(request)<Api>({
      endpoint: 'http://localhost/rpc',
      onUnauthorized
    });

    await expect(client.fn.call({})).rejects.toMatchObject({ data: { status: 500 } });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('nonIdempotentMethods force retry off for those methods only', async () => {
    let request = vi.fn(async (call: any) => ({
      data: { ok: true },
      status: 200,
      headers: {}
    }));
    let client = clientBuilder(request)<Api>({
      endpoint: 'http://localhost/rpc',
      nonIdempotentMethods: ['fn:create']
    });

    await client.fn.call({});
    await (client.fn.create as any)({}, { retry: true });

    expect(request.mock.calls.map(([call]) => [call.name, call.retry])).toEqual([
      ['fn:call', undefined],
      ['fn:create', false]
    ]);
  });
});
