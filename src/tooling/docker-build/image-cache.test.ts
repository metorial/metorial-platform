import { afterEach, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let directories: string[] = [];
let script = join(import.meta.dir, 'image-cache.ts');
let fixture = async () => {
  let directory = mkdtempSync(join(tmpdir(), 'image-cache-test-'));
  directories.push(directory);
  await Bun.write(join(directory, 'Dockerfile'), 'FROM alpine:latest AS base\nCOPY --from=node:22 /usr/local/bin/node /node\nCOPY "src/" /app/\n');
  await Bun.write(join(directory, 'src/index.ts'), 'export let value = 1;');
  await Bun.write(join(directory, 'unrelated/index.ts'), 'export let value = 1;');
  await Bun.write(join(directory, 'bin/regctl'), `#!/bin/sh
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
`);
  chmodSync(join(directory, 'bin/regctl'), 0o755);
  for (let args of [['init', '-q'], ['add', '.']]) {
    let result = Bun.spawnSync(['git', ...args], { cwd: directory });
    expect(result.exitCode).toBe(0);
  }
  return directory;
};
let resolveImage = (directory: string, argumentsValue = '{}', environment: Record<string, string> = {}) => {
  let result = Bun.spawnSync([process.execPath, script, 'resolve', 'Dockerfile', 'registry/service', 'registry/canonical', argumentsValue], {
    cwd: directory,
    env: { ...process.env, PATH: `${directory}/bin:${process.env.PATH}`, RUNNER_TEMP: directory, ...environment, GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '' }
  });
  return { code: result.exitCode, text: result.stdout.toString(), error: result.stderr.toString(), tag: result.stdout.toString().match(/^tag=(.+)$/m)?.[1] };
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
  expect(resolveImage(directory, '{}', { BASE_DIGEST: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' }).tag).not.toBe(original.tag);
  let pinned = await Bun.file(join(directory, `image-${original.tag}`, 'Dockerfile')).text();
  expect(pinned).toContain('COPY --from=node:22@sha256:');
  await Bun.write(join(directory, 'Dockerfile'), (await Bun.file(join(directory, 'Dockerfile')).text()) + 'LABEL variant=changed\n');
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
  let initialized = resolveImage(directory, '{}', { REGISTRY_ERROR: 'denied', IMAGE_CACHE_PUBLISH: 'true', ALLOW_INITIALIZE: 'true' });
  expect(initialized.code, initialized.error).toBe(0);
  expect(initialized.text).toContain('hit=false');
});

test('real Turbo pruning includes transitive sources and dependency resolutions', async () => {
  let directory = await fixture();
  await Bun.write(join(directory, 'package.json'), JSON.stringify({ name: 'fixture', packageManager: 'bun@1.2.22', private: true, workspaces: ['packages/*'] }));
  await Bun.write(join(directory, 'bunfig.toml'), '');
  await Bun.write(join(directory, 'turbo.json'), JSON.stringify({ tasks: { build: { dependsOn: ['^build'] }, '@fixture/app#build': { dependsOn: ['^build', '@fixture/tool#build'] } } }));
  await Bun.write(join(directory, 'packages/app/package.json'), JSON.stringify({ name: '@fixture/app', scripts: { build: 'echo app' }, dependencies: { '@fixture/library': 'workspace:*' } }));
  await Bun.write(join(directory, 'packages/library/package.json'), JSON.stringify({ name: '@fixture/library', scripts: { build: 'echo library' }, dependencies: { 'is-number': '7.0.0' } }));
  await Bun.write(join(directory, 'packages/library/src/index.ts'), 'export let library = 1;');
  await Bun.write(join(directory, 'packages/tool/package.json'), JSON.stringify({ name: '@fixture/tool', scripts: { build: 'echo tool' } }));
  await Bun.write(join(directory, 'packages/tool/src/index.ts'), 'export let tool = 1;');
  await Bun.write(join(directory, 'packages/unrelated/package.json'), JSON.stringify({ name: '@fixture/unrelated', scripts: { build: 'echo unrelated' } }));
  await Bun.write(join(directory, 'packages/unrelated/src/index.ts'), 'export let unrelated = 1;');
  await Bun.write(join(directory, 'src/tooling/docker-build/prune.ts'), await Bun.file(join(import.meta.dir, 'prune.ts')).text());
  await Bun.write(join(directory, 'src/tooling/docker-build/dependency-cache.ts'), await Bun.file(join(import.meta.dir, 'dependency-cache.ts')).text());
  await Bun.write(join(directory, 'src/tooling/warp-cache/run-turbo.sh'), 'echo fixture');
  await Bun.write(join(directory, 'Dockerfile'), 'FROM alpine:latest AS pruner\nCOPY . .\nRUN bun ./src/tooling/docker-build/prune.ts build --filter=@fixture/app\nFROM scratch AS pruned\nCOPY --from=pruner /app/out /\n');
  let install = Bun.spawnSync([process.execPath, 'install', '--lockfile-only', '--ignore-scripts'], { cwd: directory });
  expect(install.exitCode).toBe(0);
  let lockfile = await Bun.file(join(directory, 'bun.lock')).text();
  await Bun.write(join(directory, 'bun.lock'), lockfile.replace(/"lockfileVersion":\s*2/, '"lockfileVersion": 1'));
  Bun.spawnSync(['git', 'add', '.'], { cwd: directory });
  let key = () => {
    let result = Bun.spawnSync([process.execPath, join(directory, 'src/tooling/docker-build/dependency-cache.ts'), 'fingerprint', 'Dockerfile', 'build', '--filter=@fixture/app'], {
      cwd: directory, env: { ...process.env, DOCKER_BUILD_METADATA_ONLY: 'true' }
    });
    expect(result.exitCode).toBe(0);
    return result.stdout.toString();
  };
  let metadataKey = key();
  let cache = join(directory, 'metadata');
  let metadataEnvironment = { DOCKER_BUILD_CACHE_DIRECTORY: cache };
  let original = resolveImage(directory, '{}', metadataEnvironment);
  expect(original.code, original.error).toBe(0);
  let warmEnvironment = { ...metadataEnvironment, IMAGE_METADATA_CACHE_HIT: 'true' };
  expect(resolveImage(directory, '{}', warmEnvironment).tag).toBe(original.tag);
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
  await Bun.write(join(directory, 'bun.lock'), (await Bun.file(join(directory, 'bun.lock')).text()).replaceAll('is-number@7.0.0', 'is-number@6.0.0'));
  expect(key()).not.toBe(metadataKey);
  expect(resolveImage(directory).tag).not.toBe(original.tag);
  await Bun.write(join(directory, 'bun.lock'), lockfile.replace(/"lockfileVersion":\s*2/, '"lockfileVersion": 1'));
  await Bun.write(join(directory, 'packages/library/src/index.ts'), 'changed');
  expect(resolveImage(directory).tag).not.toBe(original.tag);
  await Bun.write(join(directory, 'packages/library/src/index.ts'), 'export let library = 1;');
  await Bun.write(join(directory, 'packages/tool/src/index.ts'), 'changed');
  expect(resolveImage(directory).tag).not.toBe(original.tag);
  expect(resolveImage(directory, '{}', warmEnvironment).tag).toBe(resolveImage(directory).tag);
}, 30000);
