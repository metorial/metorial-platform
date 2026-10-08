import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('Turbo reuses standalone results and invalidates dependencies, configuration, environment and failed tasks', () => {
  let temporary = mkdtempSync(join(tmpdir(), 'test-cache-'));
  let workspace = join(temporary, 'repo');
  let counter = join(temporary, 'counter');
  let configuration = JSON.parse(readFileSync('turbo.json', 'utf8'));
  let run = (args: string[], env: Record<string, string> = {}) =>
    Bun.spawnSync(args, {
      cwd: workspace,
      env: { ...process.env, ...env },
      stdout: 'pipe',
      stderr: 'pipe'
    });
  try {
    mkdirSync(join(workspace, 'packages/app'), { recursive: true });
    mkdirSync(join(workspace, 'packages/util'), { recursive: true });
    mkdirSync(join(workspace, 'packages/db'), { recursive: true });
    writeFileSync(
      join(workspace, 'package.json'),
      JSON.stringify({
        name: 'cache-fixture',
        private: true,
        packageManager: 'bun@1.4.2',
        workspaces: ['packages/*']
      })
    );
    writeFileSync(
      join(workspace, 'packages/app/package.json'),
      JSON.stringify({
        name: 'app',
        scripts: { test: 'bun check.ts' },
        dependencies: { util: 'workspace:*' }
      })
    );
    writeFileSync(
      join(workspace, 'packages/util/package.json'),
      JSON.stringify({ name: 'util', version: '1.0.0', dependencies: { db: 'workspace:*' } })
    );
    writeFileSync(
      join(workspace, 'packages/db/package.json'),
      JSON.stringify({
        name: 'db',
        version: '1.0.0',
        scripts: { 'prisma:generate': 'bun generate.ts' }
      })
    );
    writeFileSync(
      join(workspace, 'packages/db/generate.ts'),
      "import { mkdirSync, writeFileSync } from 'node:fs'; mkdirSync('prisma/generated', { recursive: true }); writeFileSync('prisma/generated/client.txt', 'generated');"
    );
    writeFileSync(join(workspace, 'packages/util/source.ts'), 'export let value = 1;');
    writeFileSync(join(workspace, 'tsconfig.json'), '{}');
    writeFileSync(join(workspace, '.gitignore'), 'node_modules/\n.turbo/\ngenerated/\n');
    writeFileSync(join(workspace, 'packages/app/README.md'), 'docs');
    writeFileSync(
      join(workspace, 'packages/app/check.ts'),
      "import { existsSync, readFileSync, writeFileSync } from 'node:fs'; if (!existsSync('../db/prisma/generated/client.txt')) throw new Error('Transitive Prisma prerequisite missing'); let path = process.env.TEST_COUNTER!; writeFileSync(path, String((existsSync(path) ? Number(readFileSync(path, 'utf8')) : 0) + 1)); if (process.env.TEST_FAIL === 'true') process.exit(1);"
    );
    writeFileSync(
      join(workspace, 'turbo.json'),
      JSON.stringify({
        tasks: {
          build: configuration.tasks.build,
          'prisma:generate': configuration.tasks['prisma:generate'],
          'test:inputs': configuration.tasks['test:inputs'],
          test: {
            ...configuration.tasks.test,
            env: [...configuration.tasks.test.env, 'TEST_FAIL'],
            passThroughEnv: ['TEST_COUNTER']
          }
        }
      })
    );
    expect(run(['git', 'init']).exitCode).toBe(0);
    expect(run(['bun', 'install', '--lockfile-only', '--ignore-scripts']).exitCode).toBe(0);
    expect(run(['git', 'add', '.']).exitCode).toBe(0);
    let count = () => Number(readFileSync(counter, 'utf8'));
    let execute = (env: Record<string, string> = {}) =>
      run(
        [
          resolve('node_modules/.bin/turbo'),
          'run',
          'test',
          '--filter=app',
          '--cache=local:rw',
          '--ui=stream'
        ],
        {
          TEST_COUNTER: counter,
          TEST_CACHE_RUNTIME: 'linux-node22-bun142',
          TEST_FAIL: 'false',
          ...env
        }
      );
    expect(execute().exitCode).toBe(0);
    expect(count()).toBe(1);
    rmSync(join(workspace, 'packages/db/prisma/generated'), { recursive: true });
    expect(execute().exitCode).toBe(0);
    expect(
      readFileSync(join(workspace, 'packages/db/prisma/generated/client.txt'), 'utf8')
    ).toBe('generated');
    expect(count()).toBe(1);
    writeFileSync(join(workspace, 'packages/app/README.md'), 'changed documentation');
    expect(execute().exitCode).toBe(0);
    expect(count()).toBe(1);
    writeFileSync(join(workspace, 'packages/util/source.ts'), 'export let value = 2;');
    expect(execute().exitCode).toBe(0);
    expect(count()).toBe(2);
    writeFileSync(join(workspace, 'tsconfig.json'), '{"compilerOptions":{}}');
    expect(execute().exitCode).toBe(0);
    expect(count()).toBe(3);
    expect(execute({ TEST_CACHE_RUNTIME: 'different-runtime' }).exitCode).toBe(0);
    expect(count()).toBe(4);
    expect(execute({ TEST_FAIL: 'true' }).exitCode).not.toBe(0);
    expect(execute({ TEST_FAIL: 'true' }).exitCode).not.toBe(0);
    expect(count()).toBe(6);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}, 60000);
