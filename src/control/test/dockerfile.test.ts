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
    expect(contents).toContain('USER metorial');
    expect(contents).toContain('ENTRYPOINT ["/usr/bin/tini", "--"]');
    expect(contents).toContain('CMD ["bun","./dist/index.js"]');
    expect(contents).toContain('curl -fsS http://127.0.0.1:3000/ping');
    expect(contents).not.toContain('control-runtime');
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
    generate(root, { write: true });
    let contents = readFileSync(join(directory, 'Dockerfile'), 'utf8');

    expect(contents).toContain('"schema": "prisma/main/schema"');
    expect(contents).toContain('migrate main && exec bun ./dist/index.js');
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

  test('normalizes defaults', () => {
    let build = normalizeBuild({ kind: 'bun-service' });

    expect(build.tasks).toEqual(['prisma:generate', 'server:build']);
    expect(build.start).toBe('dist/index.js');
    expect(build.modules).toBe('none');
  });
});
