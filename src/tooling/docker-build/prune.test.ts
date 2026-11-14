import { afterEach, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let directories: string[] = [];

afterEach(() => {
  for (let directory of directories) rmSync(directory, { recursive: true, force: true });

  directories = [];
});

test('Docker pruning preserves nested scoped dependencies when Turbo rehoists their parent', async () => {
  let directory = mkdtempSync(join(tmpdir(), 'docker-prune-test-'));
  directories.push(directory);

  let workspace = { name: '@fixture/worker', dependencies: { '@sentry/bun': '11.11.0' } };
  let source = {
    lockfileVersion: 1,
    workspaces: { '': {}, 'apps/worker': workspace },
    packages: {
      '@fixture/worker': ['@fixture/worker@workspace:apps/worker'],
      '@sentry/conventions': ['@sentry/conventions@0.27.0', '', {}, 'older-integrity'],
      '@fixture/worker/@sentry/bun': [
        '@sentry/bun@11.11.0',
        '',
        { dependencies: { '@sentry/node': '11.11.0', '@sentry/conventions': '^0.30.0' } },
        'bun-integrity'
      ],
      '@fixture/worker/@sentry/bun/@sentry/node': [
        '@sentry/node@11.11.0',
        '',
        { dependencies: { '@sentry/conventions': '^0.30.0' } },
        'node-integrity'
      ],
      '@fixture/worker/@sentry/bun/@sentry/conventions': [
        '@sentry/conventions@0.30.0',
        '',
        {},
        'conventions-integrity'
      ],
      unrelated: ['unrelated@1.0.0', '', {}, 'unrelated-integrity']
    }
  };
  let pruned = {
    ...source,
    packages: {
      '@fixture/worker': source.packages['@fixture/worker'],
      '@fixture/worker/@sentry/bun': source.packages['@fixture/worker/@sentry/bun'],
      '@fixture/worker/@sentry/bun/@sentry/conventions':
        source.packages['@fixture/worker/@sentry/bun/@sentry/conventions'],
      '@sentry/node': source.packages['@fixture/worker/@sentry/bun/@sentry/node'],
      '@sentry/conventions': source.packages['@sentry/conventions']
    }
  };

  await Bun.write(join(directory, 'package.json'), JSON.stringify({ name: 'fixture' }));
  await Bun.write(join(directory, 'bun.lock'), JSON.stringify(source));
  await Bun.write(join(directory, 'bunfig.toml'), '');
  await Bun.write(join(directory, 'apps/worker/package.json'), JSON.stringify(workspace));

  await Bun.write(join(directory, 'src/tooling/warp-cache/run-turbo.sh'), '');
  await Bun.write(
    join(directory, 'graph.json'),
    JSON.stringify({ '@fixture/worker': 'apps/worker' })
  );
  await Bun.write(join(directory, 'pruned.json'), JSON.stringify(pruned));

  await Bun.write(
    join(directory, 'turbo'),
    `#!${process.execPath}
import { mkdirSync } from 'node:fs';
mkdirSync('out/json', { recursive: true });
mkdirSync('out/full', { recursive: true });
await Bun.write('out/bun.lock', Bun.file('pruned.json'));
await Bun.write('out/json/bun.lock', Bun.file('pruned.json'));
`
  );
  chmodSync(join(directory, 'turbo'), 0o755);

  let result = Bun.spawnSync([process.execPath, join(import.meta.dir, 'prune.ts'), 'build'], {
    cwd: directory,
    env: {
      ...process.env,
      TEST_PRUNE_GRAPH: join(directory, 'graph.json'),
      TURBO_EXECUTABLE: join(directory, 'turbo')
    }
  });
  expect(result.exitCode, result.stderr.toString()).toBe(0);

  for (let path of ['out/bun.lock', 'out/json/bun.lock']) {
    let restored = await Bun.file(join(directory, path)).json();
    expect(restored.packages).toEqual({
      '@fixture/worker': source.packages['@fixture/worker'],
      '@fixture/worker/@sentry/bun': source.packages['@fixture/worker/@sentry/bun'],
      '@fixture/worker/@sentry/bun/@sentry/node':
        source.packages['@fixture/worker/@sentry/bun/@sentry/node'],
      '@fixture/worker/@sentry/bun/@sentry/conventions':
        source.packages['@fixture/worker/@sentry/bun/@sentry/conventions']
    });
  }
});
