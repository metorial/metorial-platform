import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { detect } from '../src/root';
import { atomicWrite, readJson } from '../src/files';
import * as environment from '../src/environment';
import * as manifest from '../src/manifest';
import * as workspace from '../src/workspace';
import * as turbo from '../src/turbo';
import * as cleanup from '../src/cleanup';
import * as proxy from '../src/proxy';
import * as infrastructure from '../src/infrastructure';
import { packageDirectory, parseArguments } from '../src/cli';
import { rustHash, rustString, rustPathHash } from '../src/hash';
import { hostsMarkdown, vscodeUri, workspaceVolumes } from '../src/workspace-dev';
import { checkout, packageFixture, project, temporary, workspaceData } from './helpers';

let load = (text: string) => {
  let root = temporary();
  packageFixture(root, '', 'api', text, { dev: 'true' });

  return manifest.load(join(root, 'control.toml'));
};

describe('CLI contract', () => {
  test.each([
    ['workspace', 'start', '--rebuild'],
    ['workspace', 'connect', 'feature/cli', '--no-open'],
    ['workspace', 'create', 'feature/cli'],
    ['workspace', 'remove', 'feature/cli'],
    ['workspace', 'list'],
    ['workspace', 'dev'],
    ['workspace', 'shell', 'feature/cli'],
    ['workspace', 'stop', 'feature/cli', '--volumes'],
    ['workspace', 'status'],
    ['start', '--no-docker', 'backend'],
    ['prepare', '--no-docker', 'backend'],
    ['db', 'generate', '@metorial/db'],
    ['db', 'push', 'backend'],
    ['docker', 'stop'],
    ['ci', 'describe', '--json'],
    ['env', '--json'],
    ['cleanup', '--dry-run', '--docker'],
    ['test:unit', '@lowerdeck/hash', '!@x/shuttle', '@x/api...', '[HEAD^]']
  ] as string[][])('accepts %j', (...args) =>
    expect(() => parseArguments(args)).not.toThrow()
  );

  test.each([
    [],
    ['workspace'],
    ['workspace', 'create'],
    ['workspace', 'list', 'extra'],
    ['workspace', 'create', 'feature/cli', '--runtime=docker'],
    ['workspace', 'feature/control'],
    ['test:e2e', '--workspace', '/tmp/ws'],
    ['test:e2e', '--concurrency=-1'],
    ['test:e2e', '--concurrency=4294967296'],
    ['dev', '--unknown'],
    ['dev', '--root'],
    ['unknown']
  ] as string[][])('rejects %j', (...args) => expect(() => parseArguments(args)).toThrow());

  test('passes all run arguments through and handles globals before run', () => {
    let args = ['--help', '--silent', 'test', '--', '--update-snapshots'];

    expect(parseArguments(['--oss', 'run', ...args]).positional).toEqual(args);
    expect(parseArguments(['--oss', 'run', ...args]).oss).toBe(true);
    expect(
      parseArguments(['test:e2e', '@x/api', '--', 'e2e/management', '-t', 'creates']).testArgs
    ).toEqual(['e2e/management', '-t', 'creates']);
  });

  test('enterprise root wins from inside nested OSS; files and git worktrees work', () => {
    let value = checkout('enterprise');
    mkdirSync(join(value.oss, 'src/deep'), { recursive: true });

    expect(detect(join(value.oss, 'src/deep'))).toEqual(value);

    let standalone = checkout();

    expect(detect(standalone.root)).toEqual(standalone);
    expect(() => detect(temporary())).toThrow('could not find');
  });

  test('package run rejects both roots and finds nearest nested package', () => {
    let value = checkout('enterprise');
    let directory = packageFixture(value.root, 'src/api', 'api');
    mkdirSync(join(directory, 'nested/deep'), { recursive: true });

    expect(packageDirectory(value, join(directory, 'nested/deep'))).toBe(directory);
    expect(() => packageDirectory(value, value.root)).toThrow('project root does not count');
    expect(() => packageDirectory(value, value.oss)).toThrow('project root does not count');
  });
});

describe('environment parity', () => {
  test('resolves all value forms and isolated lookups', () => {
    let root = {
      METORIAL_HOSTNAME: 'feature.localhost',
      TOKEN: 'root',
      CONTROL_ENV_ISOLATED: '1'
    };
    let result = environment.resolveEnvironment(
      {
        LITERAL: '{{HOSTNAME}}',
        TOKEN: true,
        MISSING: true,
        DEFAULT: { from: 'absent', default: '{{HOSTNAME}}' },
        VALUE: { value: 'fixed' },
        FROM: { from: 'TOKEN', required: true }
      },
      root
    );

    expect(result).toEqual({
      LITERAL: 'feature.localhost',
      TOKEN: 'root',
      DEFAULT: 'feature.localhost',
      VALUE: 'fixed',
      FROM: 'root'
    });
    expect(() =>
      environment.resolveEnvironment({ REQUIRED: { required: true } }, root)
    ).toThrow('required environment variable');
    expect(environment.resolveEnvironment({ PATH: true }, root)).toEqual({});
  });

  test.each(['{{NOPE}}', '{{HOSTNAME', '{{HOSTNAME}}'])('rejects unresolved %s', value =>
    expect(() => environment.interpolate(value, {})).toThrow()
  );

  test('flattens env.json scalars and rejects arrays', () => {
    expect(
      environment.flattenJson({
        AWS: { KEY: 'secret', NUMBER: 2, ENABLED: true, EMPTY: null }
      })
    ).toEqual({ AWS_KEY: 'secret', AWS_NUMBER: '2', AWS_ENABLED: 'true' });
    expect(() => environment.flattenJson({ ARRAY: [] })).toThrow('must be scalar');
  });

  test('encodes credentials, database names and authSource', () => {
    let db = {
      package: 'db',
      host: 'localhost',
      port: 5432,
      user: 'a@b',
      password: 'a/b!',
      database: 'app name'
    };

    expect(environment.postgresUrl(db)).toBe(
      'postgresql://a%40b:a%2Fb%21@localhost:5432/app%20name'
    );
    expect(environment.mongoUrl({ ...db, auth_source: 'admin db' })).toBe(
      'mongodb://a%40b:a%2Fb%21@localhost:5432/app%20name?authSource=admin%20db'
    );
  });

  test.each([
    '',
    'plain',
    'space value',
    '{"json":"value"}',
    'dollar$value',
    'both\'and"quotes',
    'line\nvalue'
  ])('formats dotenv %j', value => {
    let path = join(temporary(), '.env');
    environment.writeDotenv(path, { VALUE: value });

    expect(readFileSync(path, 'utf8')).toBe(`VALUE=${environment.formatDotenvValue(value)}\n`);
  });

  test('uses structured endpoint, dependency and resource variables', () => {
    let loaded = load(
      "name='api'\n[endpoints.http]\nport=4310\nenv=[{key='LISTEN',value='{{BIND_PORT}}'},{key='PUBLIC',value='http://{{HOSTNAME}}:{{PORT}}'}]\n[[resources]]\ntype='etcd'\nenv=[{key='ETCD',value='{{HOSTNAME}}:{{PORT}}/{{CONTROL_PORT_ETCD_PEER}}'}]"
    );
    loaded.manifest.endpoints.http!.bind_port = 42000;

    let result = environment.allForManifest(loaded, {
      METORIAL_HOSTNAME: 'feature.localhost',
      CONTROL_SERVICE_ETCD: 'etcd:2379'
    });

    expect(result).toMatchObject({
      LISTEN: '42000',
      PUBLIC: 'http://feature.localhost:4310',
      ETCD: 'etcd:2379/2380'
    });
  });
});

describe('workspace and runtime state', () => {
  test.each([
    '',
    '-bad',
    'x..y',
    'bad name',
    'x~y',
    'x:y',
    'x?',
    'x*',
    'x[',
    'x\\y',
    'trailing/',
    'trailing.',
    'a//b'
  ])('rejects branch %j', value => expect(() => workspace.validateBranch(value)).toThrow());

  test('preserves branch identities, resource names and editor URIs', () => {
    expect(workspace.workspaceId('Feature/Auth_Fix')).toBe('feature-auth-fix');
    expect(workspace.workspaceHostname('Feature/Auth_Fix')).toBe(
      'metorial-feature-auth-fix.localhost'
    );
    expect(workspace.workspacePath('/code/metorial', 'feature/auth')).toBe(
      '/code/metorial-feature-auth'
    );

    let data = workspaceData('/code');

    expect(workspaceVolumes(data)).toHaveLength(8);
    expect(vscodeUri('container', '/workspace')).toBe(
      'vscode-remote://attached-container+7b22636f6e7461696e65724e616d65223a22636f6e7461696e6572227d/workspace'
    );
    expect(hostsMarkdown(data, [])).toContain('_No named endpoints declared._');
  });

  test('parses worktree porcelain with detached and prunable entries', () => {
    expect(
      workspace.parseWorktreeList(
        'worktree /code/main\nbranch refs/heads/main\n\nworktree /code/detached\ndetached\n\nworktree /code/old\nbranch refs/heads/old\nprunable gitdir missing\n'
      )
    ).toEqual([
      { path: '/code/main', branch: 'main', prunable: false },
      { path: '/code/detached', prunable: false },
      { path: '/code/old', branch: 'old', prunable: true }
    ]);
  });

  test('old metadata defaults to Docker runtime', () => {
    let root = temporary();
    atomicWrite(
      join(root, '.control/workspace.json'),
      JSON.stringify({
        id: 'old',
        hostname: 'old.localhost',
        branch: 'old',
        source_root: '/code'
      })
    );

    expect(workspace.metadataIfPresent(root)).toMatchObject({
      runtime: 'docker',
      endpoint_ports: {}
    });
  });

  test('allocates available ports excluding reservations', async () => {
    let ports = await workspace.allocatePortValues(new Set([30000, 30001, 30002]), 6);

    expect(new Set(ports).size).toBe(6);
    expect(ports.every(port => port >= 30003 && port < 60000)).toBe(true);
    expect(await workspace.allocatePortValues(new Set(), 0)).toEqual([]);
  });

  test('host endpoint allocations preserve public ports and previous assignments', async () => {
    let root = temporary();
    await Bun.$`git init -q ${root}`.quiet();

    let directory = packageFixture(
      root,
      'api',
      'api',
      "name='api'\n[endpoints.http]\nport=4310\nenv=[{key='PORT',value='{{BIND_PORT}}'}]\n[endpoints.metrics]\nport=4311"
    );
    let data = workspaceData(root, { endpoint_ports: { api: { http: 42000 } } });
    workspace.writeMetadata(root, data);

    let all = manifest.discover(root);
    await workspace.configureManifests(project(root), all);

    expect(all[0]!.manifest.endpoints.http).toMatchObject({ port: 4310, bind_port: 42000 });

    let allocated = workspace.metadataIfPresent(root)!.endpoint_ports.api!.metrics!;

    expect(allocated).toBeGreaterThanOrEqual(30000);
    expect(allocated).not.toBe(42000);
    expect(
      environment.allForManifest(all[0]!, environment.rootEnvironment(project(root))).PORT
    ).toBe('42000');
    expect(existsSync(join(directory, '.env'))).toBe(false);
  });
});

describe('generated workspaces and infrastructure', () => {
  test('generates isolated Turbo mirrors and valid local dependency graph', () => {
    let loaded = load(
      "[package]\nname='@metorial/api'\n[run.dev]\ncommand='echo api'\n[run.worker]\ncommand='echo worker'\ndepends_on=['dev']"
    );
    let packages = turbo.plan([loaded], '/', {});
    let path = join(temporary(), '.control/dev/turbo');
    turbo.generate(path, packages);

    expect(packages.map(item => item.name)).toEqual(['api', 'api-worker']);
    expect(readJson(join(path, 'packages/api-worker/package.json'))).toMatchObject({
      dependencies: { api: '*' }
    });
    expect(readJson(join(path, 'turbo.json'))).toMatchObject({
      tasks: { dev: { cache: false, persistent: true } }
    });
    expect(readFileSync(join(path, 'packages/api/run.mjs'), 'utf8')).toContain(
      "['/bin/sh', '-eu', '-c', command]"
    );

    turbo.generate(path, packages.slice(0, 1));

    expect(existsSync(join(path, 'packages/api-worker'))).toBe(false);
  });

  test.each(['postgres', 'mongo', 'redis', 'nats', 'etcd'] as const)(
    'renders only requested %s infrastructure',
    type => {
      let requirements = {
        postgres: false,
        mongo: false,
        redis: false,
        nats: false,
        etcd: false,
        [type]: true
      };
      let rendered = JSON.parse(
        infrastructure.renderCompose(requirements, {
          network: 'test',
          ports: environment.defaultPorts,
          restart: true
        })
      );

      expect(Object.keys(rendered.services)).toHaveLength(1);
      expect(Object.keys(rendered.volumes)).toEqual([`${type}-data`]);
    }
  );

  test('cleanup stays confined and collects legacy generated directories', () => {
    let loaded = load("[cleanup]\npaths=['build','../outside','/absolute']");
    let root = dirname(loaded.path);
    mkdirSync(join(root, 'build'), { recursive: true });

    mkdirSync(join(root, 'api/node_modules/deep'), { recursive: true });

    let items = cleanup.plan(root, [loaded]);

    expect(items.some(item => item.path.endsWith('/build'))).toBe(true);
    expect(items.some(item => item.path.endsWith('/outside'))).toBe(false);
    expect(items.some(item => item.path.endsWith('/api/node_modules'))).toBe(true);
  });

  test('proxy sessions merge, reject conflicts, and remove routes on unregister', async () => {
    let root = temporary();
    let value = project(root);
    let data = workspaceData(root);
    let first = load("name='api'\n[endpoints.http]\nport=4310");

    let second = load("name='worker'\n[endpoints.http]\nport=4311");
    let unregisterFirst = await proxy.register(value, data, [first]);
    let unregisterSecond = await proxy.register(value, data, [second]);
    let dynamic = join(root, '.control/proxy/dynamic/feature.yml');

    expect(readFileSync(dynamic, 'utf8')).toContain('4310');
    expect(readFileSync(dynamic, 'utf8')).toContain('4311');

    await expect(proxy.register(value, data, [first])).rejects.toThrow(
      'active development service'
    );

    await unregisterFirst();

    expect(readFileSync(dynamic, 'utf8')).not.toContain('4310');

    await unregisterSecond();

    expect(existsSync(dynamic)).toBe(false);
  });

  test('proxy binds IPv4 and IPv6 loopbacks and redirects root HTTP', () => {
    let compose = JSON.parse(proxy.renderCompose('/proxy', new Set([4310])));

    expect(compose.services.traefik.ports).toContain('127.0.0.1:4310:4310');
    expect(compose.services.traefik.ports).toContain('[::1]:4310:4310');
    expect(
      JSON.parse(proxy.renderStatic(new Set([4310]))).entryPoints['port-80'].http.redirections
        .entryPoint.to
    ).toBe('port-4300');
  });

  test.each([
    ['hello', 'e037876b880b8ed9', '1a4ced04d3102c21'],
    ['/foo/bar', '1204ac5b5b634a0a', 'c631fe19c6d2706b'],
    ['', '30406ea523c53def', 'bd60acb658c79e45']
  ])('keeps Rust resource hashes for %j', (value, stringHash, pathHash) => {
    expect(rustHash(rustString(value))).toBe(stringHash);
    expect(rustPathHash(value)).toBe(pathHash);
  });
});
