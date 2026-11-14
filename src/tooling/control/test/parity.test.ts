import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { packageFixture, project, temporary, workspaceData } from './helpers';
import { atomicWrite, readJson } from '../src/files';
import { writeMetadata } from '../src/workspace';

interface CommandFixture {
  args: string[];
  code: number;
  stdout: string;
  dotenv?: string;
}

let commandFixtures = readJson<CommandFixture[]>(
  join(import.meta.dir, 'fixtures/commands.json')
);

let main = resolve(import.meta.dir, '../src/main.ts');

let execute = async (program: string[], args: string[], root: string) => {
  let child = Bun.spawn([...program, '--root', root, ...args], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, TURBO_EXECUTABLE: '/not/installed/control-parity-turbo' }
  });
  let [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);

  return { stdout, stderr, code };
};

let fixture = () => {
  let root = temporary();

  return Bun.$`git init -q ${root}`.quiet().then(() => {
    packageFixture(root, '', '@metorial/oss', "[groups]\nbackend=['api']");
    packageFixture(
      root,
      'src/dependency',
      'dependency',
      "name='dependency'\n[endpoints.http]\nport=52000\nhealth='/ping'\n[e2e]\nstart=['e2e:start']\nimage='dependency'\n[[ci.images]]\nname='dependency'",
      { 'e2e:start': 'true' }
    );
    packageFixture(
      root,
      'src/api',
      'api',
      "name='api'\ngroup='backend'\ndependencies=['dependency']\n[endpoints.http]\nport=52001\nhealth='/ping'\n[dev]\nrun=['dev:start']\n[dev.env]\nVALUE='literal'\nURL='http://{{HOSTNAME}}:52001'\nOPTIONAL=true\n[e2e]\nstart=['e2e:start']\nimage='api'\ntests=['../test-*']\n[[ci.images]]\nname='api'",
      { 'e2e:start': 'true', 'dev:start': 'true' }
    );

    for (let name of ['a', 'b'])
      packageFixture(root, `src/test-${name}`, `test-${name}`, undefined, {
        'test:e2e': 'true'
      });

    for (let name of ['api', 'dependency'])
      atomicWrite(join(root, 'src', name, 'Dockerfile'), 'FROM scratch\n');
    writeMetadata(
      root,
      workspaceData(root, {
        id: 'root',
        hostname: 'metorial-root.localhost',
        endpoint_ports: { api: { http: 42001 }, dependency: { http: 42000 } }
      })
    );

    return project(root);
  });
};

describe('CLI compatibility', () => {
  test.each(commandFixtures)('preserves $args', async expected => {
    let value = await fixture();
    let result = await execute([process.execPath, main], expected.args, value.root);
    let stdout = result.stdout.replaceAll(value.root, '<ROOT>');

    expect(result.code).toBe(expected.code);

    if (expected.args.includes('--json') || expected.args.includes('--plan')) {
      expect(JSON.parse(stdout)).toEqual(JSON.parse(expected.stdout));
    } else {
      expect(stdout).toBe(expected.stdout);
    }

    if (expected.dotenv !== undefined) {
      expect(readFileSync(join(value.root, 'src/api/.env'), 'utf8')).toBe(expected.dotenv);
    }
  });
});
