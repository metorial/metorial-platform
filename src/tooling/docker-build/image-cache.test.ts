import { afterEach, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, existsSync, readFileSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let directories: string[] = [];
let script = join(import.meta.dir, 'image-cache.ts');
let fixture = async () => {
  let directory = mkdtempSync(join(tmpdir(), 'image-cache-test-'));
  directories.push(directory);
  await Bun.write(
    join(directory, 'Dockerfile'),
    'FROM alpine:latest AS base\nCOPY --from=node:22 /usr/local/bin/node /node\nCOPY "src/" /app/\n'
  );
  await Bun.write(join(directory, 'src/index.ts'), 'export let value = 1;');
  await Bun.write(join(directory, 'unrelated/index.ts'), 'export let value = 1;');
  await Bun.write(
    join(directory, 'bin/regctl'),
    `#!/bin/sh
if [ "$1 $2" = 'image copy' ]; then exit 0; fi
if [ "$1 $2" = 'manifest put' ]; then
  if [ "\${ALLOW_INITIALIZE:-}" = true ]; then touch initialized; exit 0; fi
  echo unauthorized >&2; exit 1
fi
case "$3" in
  alpine:*|node:*) echo "sha256:\${BASE_DIGEST:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}" ;;
  *@*) echo "\${3##*@}" ;;
  *)
    if [ "\${REGISTRY_ERROR:-}" != '' ] && [ ! -f initialized ]; then echo "$REGISTRY_ERROR" >&2; exit 1; fi
    if [ "\${CACHE_HIT:-}" = true ]; then echo sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
    else echo 'manifest unknown: not found' >&2; exit 1; fi ;;
esac
`
  );
  chmodSync(join(directory, 'bin/regctl'), 0o755);
  for (let args of [
    ['init', '-q'],
    ['add', '.']
  ]) {
    let result = Bun.spawnSync(['git', ...args], { cwd: directory });
    expect(result.exitCode).toBe(0);
  }
  return directory;
};
let resolveImage = (
  directory: string,
  argumentsValue = '{}',
  environment: Record<string, string> = {}
) => {
  let result = Bun.spawnSync(
    [
      process.execPath,
      script,
      'resolve',
      'Dockerfile',
      'registry/service',
      'registry/canonical',
      argumentsValue
    ],
    {
      cwd: directory,
      env: {
        ...process.env,
        PATH: `${directory}/bin:${process.env.PATH}`,
        RUNNER_TEMP: directory,
        ...environment,
        GITHUB_OUTPUT: '',
        GITHUB_STEP_SUMMARY: '',
        IMAGE_DESCRIPTOR_REGISTRY: 'false'
      }
    }
  );
  return {
    code: result.exitCode,
    text: result.stdout.toString(),
    error: result.stderr.toString(),
    tag: result.stdout.toString().match(/^tag=(.+)$/m)?.[1]
  };
};

afterEach(() => {
  for (let directory of directories) rmSync(directory, { recursive: true, force: true });
  directories = [];
});

test('fingerprint covers source, build arguments and external COPY images but excludes unrelated files', async () => {
  let directory = await fixture();
  let original = resolveImage(directory);
  expect(original.code, original.error).toBe(0);
  expect(original.text).toContain('hit=false');
  await Bun.write(join(directory, 'unrelated/index.ts'), 'changed');
  expect(resolveImage(directory).tag).toBe(original.tag);
  await Bun.write(join(directory, 'src/index.ts'), 'changed');
  expect(resolveImage(directory).tag).not.toBe(original.tag);
  await Bun.write(join(directory, 'src/index.ts'), 'export let value = 1;');
  expect(resolveImage(directory, '{"METORIAL_ENV":"production"}').tag).not.toBe(original.tag);
  expect(
    resolveImage(directory, '{}', {
      BASE_DIGEST: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    }).tag
  ).not.toBe(original.tag);
  let pinned = await Bun.file(join(directory, `image-${original.tag}`, 'Dockerfile')).text();
  expect(pinned).toContain('COPY --from=node:22@sha256:');
  await Bun.write(
    join(directory, 'Dockerfile'),
    (await Bun.file(join(directory, 'Dockerfile')).text()) + 'LABEL variant=changed\n'
  );
  expect(resolveImage(directory).tag).not.toBe(original.tag);
});

test('resolves hits to immutable digests and fails on authorization errors', async () => {
  let directory = await fixture();
  let hit = resolveImage(directory, '{}', { CACHE_HIT: 'true' });
  expect(hit.code).toBe(0);
  expect(hit.text).toContain('source=registry/service@sha256:');
  expect(hit.text).toContain('hit=true');
  let denied = resolveImage(directory, '{}', { REGISTRY_ERROR: 'unauthorized' });
  expect(denied.code).not.toBe(0);
  expect(denied.error).toContain('unauthorized');
  let anonymous = resolveImage(directory, '{}', {
    REGISTRY_ERROR: 'denied',
    IMAGE_CACHE_ANONYMOUS: 'true'
  });
  expect(anonymous.code).toBe(0);
  expect(anonymous.text).toContain('hit=false');
  let initialized = resolveImage(directory, '{}', {
    REGISTRY_ERROR: 'denied',
    IMAGE_CACHE_PUBLISH: 'true',
    ALLOW_INITIALIZE: 'true'
  });
  expect(initialized.code, initialized.error).toBe(0);
  expect(initialized.text).toContain('hit=false');
});

test('real Turbo pruning includes transitive sources and dependency resolutions', async () => {
  let directory = await fixture();
  await Bun.write(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      packageManager: 'bun@1.2.22',
      private: true,
      workspaces: ['packages/*']
    })
  );
  await Bun.write(join(directory, 'bunfig.toml'), '');
  await Bun.write(
    join(directory, 'turbo.json'),
    JSON.stringify({
      tasks: {
        build: { dependsOn: ['^build'] },
        '@fixture/app#build': { dependsOn: ['^build', '@fixture/tool#build'] }
      }
    })
  );
  await Bun.write(
    join(directory, 'packages/app/package.json'),
    JSON.stringify({
      name: '@fixture/app',
      scripts: { build: 'echo app' },
      dependencies: { '@fixture/library': 'workspace:*' }
    })
  );
  await Bun.write(
    join(directory, 'packages/library/package.json'),
    JSON.stringify({
      name: '@fixture/library',
      scripts: { build: 'echo library', postinstall: 'bun ./install.ts' },
      dependencies: { 'is-number': '7.0.0' }
    })
  );
  await Bun.write(join(directory, 'packages/library/src/index.ts'), 'export let library = 1;');
  await Bun.write(join(directory, 'packages/library/install.ts'), 'console.log(1);');
  await Bun.write(
    join(directory, 'packages/tool/package.json'),
    JSON.stringify({ name: '@fixture/tool', scripts: { build: 'echo tool' } })
  );
  await Bun.write(join(directory, 'packages/tool/src/index.ts'), 'export let tool = 1;');
  await Bun.write(
    join(directory, 'packages/unrelated/package.json'),
    JSON.stringify({
      name: '@fixture/unrelated',
      scripts: { build: 'echo unrelated' },
      dependencies: { 'is-odd': '3.0.1' }
    })
  );
  await Bun.write(
    join(directory, 'packages/unrelated/src/index.ts'),
    'export let unrelated = 1;'
  );
  await Bun.write(
    join(directory, 'src/tooling/docker-build/prune.ts'),
    await Bun.file(join(import.meta.dir, 'prune.ts')).text()
  );
  await Bun.write(
    join(directory, 'src/tooling/docker-build/dependency-cache.ts'),
    await Bun.file(join(import.meta.dir, 'dependency-cache.ts')).text()
  );
  await Bun.write(join(directory, 'src/tooling/warp-cache/run-turbo.sh'), 'echo fixture');
  await Bun.write(
    join(directory, 'Dockerfile'),
    'FROM alpine:latest AS pruner\nCOPY . .\nRUN bun ./src/tooling/docker-build/prune.ts build --filter=@fixture/app\nFROM scratch AS pruned\nCOPY --from=pruner /app/out /\n'
  );
  let install = Bun.spawnSync(
    [process.execPath, 'install', '--lockfile-only', '--ignore-scripts'],
    { cwd: directory }
  );
  expect(install.exitCode).toBe(0);
  let lockfile = await Bun.file(join(directory, 'bun.lock')).text();
  await Bun.write(
    join(directory, 'bun.lock'),
    lockfile.replace(/"lockfileVersion":\s*2/, '"lockfileVersion": 1')
  );
  Bun.spawnSync(['git', 'add', '.'], { cwd: directory });
  let key = () => {
    let result = Bun.spawnSync(
      [
        process.execPath,
        join(directory, 'src/tooling/docker-build/dependency-cache.ts'),
        'fingerprint',
        'Dockerfile',
        'build',
        '--filter=@fixture/app'
      ],
      {
        cwd: directory,
        env: { ...process.env, DOCKER_BUILD_METADATA_ONLY: 'true' }
      }
    );
    expect(result.exitCode).toBe(0);
    return result.stdout.toString();
  };
  let metadataKey = key();
  let cache = join(directory, 'metadata');
  let metadataEnvironment = { DOCKER_BUILD_CACHE_DIRECTORY: cache };
  let original = resolveImage(directory, '{}', metadataEnvironment);
  expect(original.code, original.error).toBe(0);
  let snapshot = () =>
    [
      ...new Bun.Glob('**/*').scanSync({
        cwd: join(directory, 'out'),
        onlyFiles: true,
        dot: true
      })
    ]
      .sort()
      .map(path => [
        path,
        lstatSync(join(directory, 'out', path)).mode & 0o777,
        readFileSync(join(directory, 'out', path)).toString('base64')
      ]);
  let coldSnapshot = snapshot();
  let warmEnvironment = { ...metadataEnvironment, IMAGE_METADATA_CACHE_HIT: 'true' };
  rmSync(join(directory, 'out'), { recursive: true });
  let cachedHit = resolveImage(directory, '{}', { ...warmEnvironment, CACHE_HIT: 'true' });
  expect(cachedHit.code, cachedHit.error).toBe(0);
  expect(cachedHit.text).toContain('no Turbo or source copying');
  expect(existsSync(join(directory, 'out'))).toBe(false);
  expect(resolveImage(directory, '{}', warmEnvironment).tag).toBe(original.tag);
  expect(snapshot()).toEqual(coldSnapshot);
  await Bun.write(join(directory, 'packages/library/src/new.ts'), 'export let added = true;');
  Bun.spawnSync(['git', 'add', 'packages/library/src/new.ts'], { cwd: directory });
  let added = resolveImage(directory, '{}', warmEnvironment);
  expect(added.tag).not.toBe(original.tag);
  expect(resolveImage(directory).tag).toBe(added.tag);
  rmSync(join(directory, 'packages/library/src/new.ts'));
  expect(resolveImage(directory, '{}', warmEnvironment).tag).toBe(original.tag);
  await Bun.write(join(directory, 'packages/unrelated/src/index.ts'), 'changed');
  expect(resolveImage(directory).tag).toBe(original.tag);
  expect(key()).toBe(metadataKey);
  await Bun.write(join(directory, '.github/workflows/fixture.yml'), 'name: unrelated');
  Bun.spawnSync(['git', 'add', '.github/workflows/fixture.yml'], { cwd: directory });
  expect(key()).toBe(metadataKey);
  await Bun.write(join(directory, 'packages/library/install.ts'), 'console.log(2);');
  expect(key()).toBe(metadataKey);
  let lifecycleChanged = resolveImage(directory, '{}', warmEnvironment);
  expect(lifecycleChanged.code, lifecycleChanged.error).toBe(0);
  expect(lifecycleChanged.tag).not.toBe(original.tag);
  expect(lifecycleChanged.text).toContain('no Turbo or source copying');
  await Bun.write(join(directory, 'packages/library/install.ts'), 'console.log(1);');
  await Bun.write(
    join(directory, 'bun.lock'),
    (await Bun.file(join(directory, 'bun.lock')).text()).replaceAll(
      'is-odd@3.0.1',
      'is-odd@3.0.0'
    )
  );
  expect(key()).not.toBe(metadataKey);
  let unrelatedLock = resolveImage(directory, '{}', metadataEnvironment);
  expect(unrelatedLock.code, unrelatedLock.error).toBe(0);
  expect(unrelatedLock.tag).toBe(original.tag);
  await Bun.write(
    join(directory, 'bun.lock'),
    lockfile.replace(/"lockfileVersion":\s*2/, '"lockfileVersion": 1')
  );
  await Bun.write(
    join(directory, 'bun.lock'),
    (await Bun.file(join(directory, 'bun.lock')).text()).replaceAll(
      'is-number@7.0.0',
      'is-number@5.0.0'
    )
  );
  expect(key()).not.toBe(metadataKey);
  let changedResolution = resolveImage(directory);
  expect(changedResolution.code, changedResolution.error).toBe(0);
  expect(changedResolution.tag).not.toBe(original.tag);
  await Bun.write(
    join(directory, 'bun.lock'),
    lockfile.replace(/"lockfileVersion":\s*2/, '"lockfileVersion": 1')
  );
  await Bun.write(join(directory, 'packages/library/src/index.ts'), 'changed');
  expect(resolveImage(directory).tag).not.toBe(original.tag);
  await Bun.write(join(directory, 'packages/library/src/index.ts'), 'export let library = 1;');
  await Bun.write(join(directory, 'packages/tool/src/index.ts'), 'changed');
  expect(resolveImage(directory).tag).not.toBe(original.tag);
  expect(resolveImage(directory, '{}', warmEnvironment).tag).toBe(resolveImage(directory).tag);
}, 30000);

test('metadata restoration preserves deliberately partial runtime assets', async () => {
  let directory = await fixture();
  await Bun.write(join(directory, 'out/json/package.json'), '{}');
  await Bun.write(join(directory, 'assets/package.json'), '{}');
  await Bun.write(join(directory, 'assets/index.ts'), 'export let included = true;');
  await Bun.write(join(directory, 'assets/unrelated.go'), 'package ignored');
  await Bun.write(join(directory, 'out/full/assets/package.json'), '{}');
  await Bun.write(join(directory, 'out/full/assets/index.ts'), 'export let included = true;');
  Bun.spawnSync(['git', 'add', 'assets'], { cwd: directory });
  let cache = join(directory, 'metadata');
  for (let command of ['capture', 'restore']) {
    let result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, 'dependency-cache.ts'), command],
      {
        cwd: directory,
        env: { ...process.env, DOCKER_BUILD_CACHE_DIRECTORY: cache }
      }
    );
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  }
  expect(await Bun.file(join(directory, 'out/full/assets/index.ts')).text()).toBe(
    'export let included = true;'
  );
  expect(await Bun.file(join(directory, 'out/full/assets/unrelated.go')).exists()).toBe(false);
  let blueprint = await Bun.file(join(cache, 'recipe.json')).json();
  expect(blueprint.extras).toEqual([...blueprint.extras].sort());
  expect(blueprint.directories).toEqual([...blueprint.directories].sort());
  expect(blueprint.generated).toEqual([...blueprint.generated].sort());
});

test('Git identities cover modes, symlinks, staged additions and source deletions', async () => {
  let directory = await fixture();
  let original = resolveImage(directory);
  chmodSync(join(directory, 'src/index.ts'), 0o755);
  expect(resolveImage(directory).tag).not.toBe(original.tag);
  chmodSync(join(directory, 'src/index.ts'), 0o644);
  expect(resolveImage(directory).tag).toBe(original.tag);
  let { symlinkSync } = await import('node:fs');
  symlinkSync('index.ts', join(directory, 'src/link'));
  Bun.spawnSync(['git', 'add', 'src/link'], { cwd: directory });
  let linked = resolveImage(directory);
  expect(linked.tag).not.toBe(original.tag);
  rmSync(join(directory, 'src/link'));
  symlinkSync('../unrelated/index.ts', join(directory, 'src/link'));
  expect(resolveImage(directory).tag).not.toBe(linked.tag);
  rmSync(join(directory, 'src/link'));
  symlinkSync('missing-target', join(directory, 'src/link'));
  expect(resolveImage(directory).tag).not.toBe(original.tag);
  rmSync(join(directory, 'src/index.ts'));
  expect(resolveImage(directory).tag).not.toBe(original.tag);
});

test('shared OSS Git inputs have identical fingerprints inside an enterprise submodule', async () => {
  let directory = await fixture();
  let commit = Bun.spawnSync(
    [
      'git',
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-qm',
      'fixture'
    ],
    { cwd: directory }
  );
  expect(commit.exitCode).toBe(0);
  let enterprise = mkdtempSync(join(tmpdir(), 'image-cache-enterprise-'));
  directories.push(enterprise);
  for (let args of [
    ['init', '-q'],
    ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', directory, 'oss']
  ]) {
    let result = Bun.spawnSync(['git', ...args], { cwd: enterprise });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  }
  let standalone = resolveImage(directory);
  let submodule = resolveImage(join(enterprise, 'oss'));
  expect(submodule.code, submodule.error).toBe(0);
  expect(submodule.tag).toBe(standalone.tag);
});

test('descriptor validation rejects mismatched keys and unsafe paths', async () => {
  let { validateDescriptor } = await import('./input-descriptor');
  let descriptor = {
    version: 1,
    key: 'expected',
    directories: ['packages/app'],
    extras: [],
    generated: [],
    json: [
      { path: 'package.json', mode: '100644', data: 'e30=' },
      { path: 'bun.lock', mode: '100644', data: 'e30=' }
    ],
    root: []
  };
  expect(() => validateDescriptor(descriptor, 'different')).toThrow('key');
  expect(() =>
    validateDescriptor({ ...descriptor, extras: ['../escape'] }, 'expected')
  ).toThrow('extras');
  expect(() =>
    validateDescriptor(
      { ...descriptor, generated: [{ path: '/escape', mode: '100644', data: '' }] },
      'expected'
    )
  ).toThrow('generated');
});
