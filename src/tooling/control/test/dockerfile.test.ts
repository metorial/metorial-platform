import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generate } from '../src/dockerfile/generate';
import { normalizeBuild } from '../src/dockerfile/normalize';
import { checkout, packageFixture } from './helpers';

let manifestSource = (build: Record<string, unknown>) =>
  `import { rawProject } from '@metorial/control/raw';\n\nexport default rawProject(${JSON.stringify(
    {
      name: 'service',
      ci: { images: [{ name: 'service', build: { kind: 'bun-service', ...build } }] }
    }
  )});\n`;

let fixture = (build: Record<string, unknown> = {}) => {
  let root = checkout('oss');
  let directory = packageFixture(root.root, 'src/service', 'service');
  mkdirSync(join(directory, 'control'), { recursive: true });
  writeFileSync(join(directory, 'control', 'index.ts'), manifestSource(build));

  return { root, directory };
};

describe('generated Dockerfiles', () => {
  test('writes a Dockerfile beside the package with the expected stages', () => {
    let { root, directory } = fixture({
      ports: [3000],
      health: [{ port: 3000, path: '/ping' }]
    });
    let result = generate(root, { write: true });
    let contents = readFileSync(join(directory, 'Dockerfile'), 'utf8');

    expect(result.changed).toEqual([join(directory, 'Dockerfile')]);
    expect(contents).toStartWith('# syntax=docker/dockerfile:1.7');
    for (let stage of ['pruner', 'pruned', 'dependencies', 'builder', 'runner'])
      expect(contents).toContain(` AS ${stage}`);
    expect(contents).toContain(
      'RUN bun ./src/tooling/docker-build/prune.ts prisma:generate server:build --filter=service'
    );
    expect(contents).toContain('USER 10001:10001');
    expect(contents).toContain('ENTRYPOINT ["/usr/bin/tini", "--"]');
    expect(contents).toContain('CMD ["bun","./dist/index.js"]');
    expect(contents).toContain('curl -fsS http://127.0.0.1:3000/ping');
    expect(contents).not.toContain('control-runtime');
  });

  test('filters the dependency closure when closure is set', () => {
    let { root, directory } = fixture({ closure: true, tasks: ['server:build'] });
    generate(root, { write: true });
    let contents = readFileSync(join(directory, 'Dockerfile'), 'utf8');

    expect(contents).toContain('server:build --filter=service...');
    expect(contents).not.toContain('--filter=service ');
  });

  test('is stable and reports drift', () => {
    let { root, directory } = fixture();
    generate(root, { write: true });

    expect(generate(root, { write: true }).changed).toEqual([]);

    writeFileSync(join(directory, 'Dockerfile'), 'stale');
    expect(generate(root, { write: false }).changed).toEqual([join(directory, 'Dockerfile')]);
    expect(readFileSync(join(directory, 'Dockerfile'), 'utf8')).toBe('stale');
  });

  test('uses the enterprise tooling prefix in an enterprise checkout workspace', () => {
    let { root, directory } = fixture();
    mkdirSync(join(root.root, 'oss'), { recursive: true });
    writeFileSync(join(root.root, 'oss', 'package.json'), '{"name":"@metorial/oss"}');
    generate(root, { write: true });

    expect(readFileSync(join(directory, 'Dockerfile'), 'utf8')).toContain(
      './oss/src/tooling/docker-build/prune.ts'
    );
  });

  test('adds migrations, the runtime config and a migrating command', () => {
    let { root, directory } = fixture({
      migrations: [
        {
          name: 'main',
          package: 'service',
          env: 'DATABASE_URL',
          parts: 'DB',
          path: 'prisma/schema'
        }
      ]
    });
    mkdirSync(join(directory, 'prisma', 'schema'), { recursive: true });
    mkdirSync(join(directory, 'prisma', 'migrations'), { recursive: true });
    generate(root, { write: true });
    let contents = readFileSync(join(directory, 'Dockerfile'), 'utf8');

    expect(contents).toContain('./prisma/main/migrations/');
    expect(contents).toContain('"schema": "prisma/main/schema"');
    expect(contents).toContain(
      'migrate main && [ -z \\"$stop\\" ] && exec bun ./dist/index.js'
    );
    expect(contents).toContain("trap 'stop=1' TERM INT HUP");
    expect(contents).toContain('AS control-runtime');
    expect(contents).toContain('AS prisma-cli');
  });

  test('rejects migrations for unknown packages', () => {
    let { root } = fixture({
      migrations: [{ name: 'main', package: 'missing', env: 'DATABASE_URL' }]
    });

    expect(() => generate(root, { write: false })).toThrow(
      'unknown migration package missing'
    );
  });

  test('builds external modules from the bundle manifests before stripping', () => {
    let { root, directory } = fixture({
      runtime: 'bundle',
      modules: 'external',
      start: 'dist/main.mjs',
      strip: ['mongodb'],
      assets: [{ from: 'frontend/dist', to: 'public' }]
    });
    generate(root, { write: true });

    let contents = readFileSync(join(directory, 'Dockerfile'), 'utf8');
    let builder = contents.split('FROM dependencies AS builder')[1]!.split('\nFROM ')[0]!;
    let runner = contents.split(' AS runner\n')[1]!;

    expect(contents).not.toContain('AS production-dependencies');
    expect(builder).toContain(
      'RUN bun ./src/tooling/docker-build/runtime-modules.ts --node-modules /app/node_modules --out /out/node_modules --manifests /app/src/service/dist --manifests /app/src/service/frontend/dist'
    );
    expect(builder.indexOf('runtime-modules.ts --node-modules')).toBeGreaterThan(
      builder.indexOf('run-turbo.sh')
    );
    expect(builder.indexOf('runtime-modules.ts --node-modules')).toBeLessThan(
      builder.indexOf("-path '*/node_modules/mongodb'")
    );
    expect(runner).toContain('LABEL com.metorial.npm-inventory=node_modules');
    expect(runner).toContain('/out/node_modules ./node_modules');
  });

  test('rejects external modules for source runtimes', () => {
    expect(() =>
      normalizeBuild({ kind: 'bun-service', runtime: 'source', modules: 'external' })
    ).toThrow('external modules need a bundled runtime');
  });

  test('checks health with bun and upgrades OS packages when curl is left out', () => {
    let { root, directory } = fixture({
      curl: false,
      upgradePackages: true,
      health: [{ port: 3000, path: '/ping' }]
    });
    generate(root, { write: true });

    let contents = readFileSync(join(directory, 'Dockerfile'), 'utf8');
    let base = contents.split(' AS runner-base\n')[1]!.split('\nFROM ')[0]!;

    expect(base).not.toContain('curl');
    expect(base).toContain('apt-get update && apt-get upgrade -y --no-install-recommends');
    expect(contents).toContain('"bun","-e"');
    expect(contents).toContain('http://127.0.0.1:3000/ping');
    expect(contents).not.toContain('curl -fsS');
  });

  test('ships the prisma CLI without migrations when prisma is set', () => {
    let { root, directory } = fixture({ prisma: true });
    generate(root, { write: true });

    let contents = readFileSync(join(directory, 'Dockerfile'), 'utf8');

    expect(contents).toContain('AS prisma-cli');
    expect(contents).toContain('/opt/prisma /opt/prisma');
    expect(contents).toContain('ENV PRISMA_BIN=/opt/prisma/node_modules/.bin/prisma');
    expect(contents).not.toContain('control-runtime');
  });

  test('normalizes defaults', () => {
    let build = normalizeBuild({ kind: 'bun-service' });

    expect(build.tasks).toEqual(['prisma:generate', 'server:build']);
    expect(build.start).toBe('dist/index.js');
    expect(build.modules).toBe('none');
  });
});

describe('compiled release channels', () => {
  test('provides the channel before build tasks and defaults to release', () => {
    let { root, directory } = fixture({ release: true });
    generate(root, { write: true });

    let contents = readFileSync(join(directory, 'Dockerfile'), 'utf8');
    let builder = contents.split('FROM dependencies AS builder')[1]!.split('FROM ')[0]!;

    expect(builder).toContain('ARG METORIAL_RELEASE_CHANNEL=release');
    expect(
      builder.indexOf('ENV METORIAL_RELEASE_CHANNEL=${METORIAL_RELEASE_CHANNEL}')
    ).toBeLessThan(builder.indexOf('run-turbo.sh'));
  });
});
