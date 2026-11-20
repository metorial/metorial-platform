import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/commands';

let stderr = () => vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

let written = (spy: ReturnType<typeof stderr>) =>
  spy.mock.calls.map(call => String(call[0])).join('');

let scratch = () => mkdtempSync(join(process.env.TMPDIR ?? '.', 'at-dev-cli-'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('command line', () => {
  it('exits 2 on an unknown command, option or reconcile mode', async () => {
    let output = stderr();

    expect(await main(['nope'])).toBe(2);
    expect(await main(['load', '--ur', 'http://localhost'])).toBe(2);
    expect(await main(['reconcile', 'sideways', '--out', 'x'])).toBe(2);
    expect(written(output)).toMatch(/--ur/);
  });

  it('refuses hosts off the allowlist and missing targets before any contact', async () => {
    let output = stderr();
    let fetch = vi.spyOn(globalThis, 'fetch');
    let env = { BENCH_MONGO: 'mongodb://db.example/x' };

    expect(
      await main(
        ['seed', '--mongo-url-env', 'BENCH_MONGO', '--rpc-url', 'http://db.example'],
        { BENCH_MONGO: 'mongodb://localhost:1/x' }
      )
    ).toBe(2);
    expect(await main(['size', '--from-store', '--mongo-url-env', 'BENCH_MONGO'], env)).toBe(
      2
    );
    expect(await main(['cleanup', '--mongo-url-env', 'BENCH_MONGO'], env)).toBe(2);
    expect(written(output)).toMatch(/db\.example/);
    expect(written(output)).toMatch(/--rpc-url is required/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('needs the hash secret from the operator for reconcile live, and redacts it', async () => {
    let output = stderr();
    let fetch = vi.spyOn(globalThis, 'fetch');
    let directory = scratch();
    let live = (rpcUrl: string) => [
      'reconcile',
      'live',
      '--claude-projects',
      directory,
      '--out',
      join(directory, 'out'),
      '--organization',
      'ator_x',
      '--rpc-url',
      rpcUrl
    ];

    expect(await main(live('http://localhost:1'), {})).toBe(2);
    expect(await main(live('http://localhost:1'), { AGENT_TRACKING_HASH_SECRET: '' })).toBe(2);
    expect(written(output)).toMatch(/AGENT_TRACKING_HASH_SECRET/);
    expect(fetch).not.toHaveBeenCalled();

    expect(
      await main(live('http://operatorsecret.example'), {
        AGENT_TRACKING_HASH_SECRET: 'operatorsecret'
      })
    ).toBe(2);
    expect(written(output)).toMatch(/\[redacted\]\.example/);
    expect(written(output)).not.toMatch(/operatorsecret/);
  });
});
