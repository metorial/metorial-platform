import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { atomicWrite, sortJson, writeJson } from '../src/files';
import { discover } from '../src/manifest';
import {
  buildPlan,
  attachCacheKeys,
  isPinnedImage,
  parseFingerprints,
  serializedPlan,
  type Options
} from '../src/e2e-plan';
import {
  containerUrl,
  remoteCacheEnvironment,
  renderCompose,
  Compose,
  waitForHealth
} from '../src/e2e';
import { inventory } from '../src/ci';
import { project, packageFixture, temporary } from './helpers';

let options = (overrides: Partial<Options> = {}): Options => ({
  filters: [],
  keep: false,
  planOnly: true,
  testArgs: [],
  ...overrides
});

let fixture = () => {
  let root = temporary();
  packageFixture(root, '', '@metorial/oss', "mode='both'");
  packageFixture(root, 'db', 'db', undefined, {
    'control:db:generate': 'true',
    'control:db:push': 'true'
  });
  packageFixture(
    root,
    'dependency',
    'dependency',
    "name='dependency'\n[endpoints.http]\nport=52000\nhealth='/ping'\n[e2e]\nstart=['e2e:start']\nimage='dependency'",
    { 'e2e:start': 'true' }
  );

  packageFixture(
    root,
    'stack',
    'stack',
    "name='stack'\ndependencies=['dependency']\n[endpoints.http]\nport=52001\nhealth={path='/ready',status=204}\n[dev.env]\nSECRET=true\nPUBLIC='http://{{HOSTNAME}}:52001'\n[dev.db.main]\nname='app'\nengine='postgres'\nenv='DB'\npackage='db'\n[e2e]\nstart=['e2e:start']\nimage='stack'\ntests=['../tests/*']\nhealth_timeout=12\n[[e2e.resources]]\ntype='object-storage'\n[e2e.env]\nSECRET='dummy'",
    { 'e2e:start': 'true' }
  );
  packageFixture(root, 'tests/a', 'test-a', undefined, { 'test:e2e': 'true' });
  packageFixture(root, 'tests/b', 'test-b', undefined, { 'test:e2e': 'true' });
  packageFixture(root, 'tests/no-script', 'no-script');

  return project(root);
};

describe('E2E plans', () => {
  test('plans dependencies, isolated test environments, database owners and preparation order', () => {
    let value = fixture();
    let plan = buildPlan(
      value,
      discover(value.root),
      options({ testArgs: ['-t', 'creates'] })
    );

    expect(plan.dependencies.map(item => item.name)).toEqual(['dependency']);
    expect(plan.suts.map(item => item.name)).toEqual(['stack']);
    expect(plan.stacks[0]!.tests).toEqual(['test-a', 'test-b']);
    expect(plan.stacks[0]!.env.SECRET).toBe('dummy');

    expect(plan.stacks[0]!.env.PUBLIC).toBe('http://localhost:52001');
    expect(plan.stacks[0]!.services).toEqual(['dependency', 'stack']);
    expect(plan.prepare.map(item => item.label)).toEqual([
      'Generating database clients',
      'Pushing database schemas',
      'Building packages'
    ]);
    expect(plan.files.find(item => item.path === 'db/.env')!.values.DB).toContain('/app');

    expect(plan.healthTimeoutSeconds).toBe(12);
    expect(plan.testArgs).toEqual(['-t', 'creates']);
    expect(serializedPlan(plan)).not.toHaveProperty('postgres');
  });

  test.each([
    ['test-a', ['test-a']],
    ['test-*', ['test-a', 'test-b']],
    ['stack', ['test-a', 'test-b']]
  ] as [string, string[]][])('filters %s', (filter, tests) => {
    let value = fixture();

    expect(
      buildPlan(value, discover(value.root), options({ filters: [filter] })).stacks[0]!.tests
    ).toEqual(tests);
  });

  test('rejects unknown filters, missing start scripts and port collisions', () => {
    let value = fixture();
    let manifests = discover(value.root);

    expect(() => buildPlan(value, manifests, options({ filters: ['missing'] }))).toThrow(
      'matches no stack'
    );
    manifests.find(item => item.manifest.package?.name === 'dependency')!.manifest.e2e.start =
      [];

    expect(() => buildPlan(value, manifests, options())).toThrow('start scripts');
    manifests = discover(value.root);
    manifests.find(
      item => item.manifest.package?.name === 'dependency'
    )!.manifest.endpoints.http!.port = 52001;

    expect(() => buildPlan(value, manifests, options())).toThrow('both listen on port');
  });

  test('requires health checks and single ownership of test packages', () => {
    let value = fixture();
    let manifests = discover(value.root);
    delete manifests.find(item => item.manifest.package?.name === 'stack')!.manifest.endpoints
      .http!.health;

    expect(() => buildPlan(value, manifests, options())).toThrow('declares no health check');
    packageFixture(
      value.root,
      'second',
      'second',
      "name='second'\n[e2e]\ntests=['../tests/*']"
    );

    expect(() => buildPlan(value, discover(value.root), options())).toThrow('belongs to both');
  });

  test('images mode consumes tested artifacts and creates application containers', () => {
    let value = fixture();
    let images = join(value.root, 'images');

    for (let name of ['dependency', 'stack'])
      writeJson(join(images, `${name}.json`), {
        name,
        image: `ghcr.io/metorial/${name}@sha256:${'a'.repeat(64)}`
      });

    let plan = buildPlan(value, discover(value.root), options({ images, concurrency: 0 }));

    expect(plan.concurrency).toBe(1);
    expect(plan.files).toEqual([]);
    expect(plan.prepare).toEqual([]);

    let rendered = renderCompose(plan, 'test', 'runner', { workspace: '/prepared' }, '/logs');

    expect(rendered.services['app-stack']!.network_mode).toBe('service:gateway');
    expect(rendered.services['app-stack']!.image).toContain('@sha256:');
    expect(rendered.services.gateway!.sysctls).toEqual({
      'net.ipv4.ip_local_port_range': '61000 65535'
    });
    expect(rendered.services['object-storage']).toBeDefined();

    writeJson(join(images, 'stack.json'), { name: 'wrong', image: 'image' });

    expect(() => buildPlan(value, discover(value.root), options({ images }))).toThrow(
      'does not match'
    );
  });

  test('cache keys depend on service fingerprints and environments with canonical object ordering', () => {
    let value = fixture();
    let plan = buildPlan(value, discover(value.root), options());
    attachCacheKeys(plan, { dependency: 'abc', stack: 'def' });

    let first = JSON.stringify(plan.stacks[0]!.cacheKeyInputs);

    expect(first).toBe(JSON.stringify(sortJson(plan.stacks[0]!.cacheKeyInputs)));
    attachCacheKeys(plan, { dependency: 'changed', stack: 'def' });

    expect(JSON.stringify(plan.stacks[0]!.cacheKeyInputs)).not.toBe(first);
    expect(
      parseFingerprints(
        'prefix\n{"tasks":[{"taskId":"stack#e2e:fingerprint","hash":"123"}]}',
        new Set(['stack'])
      )
    ).toEqual({ stack: '123' });
    expect(() => parseFingerprints('{"tasks":[]}', new Set(['stack']))).toThrow(
      'did not fingerprint'
    );
  });

  test('forwards remote cache secrets and rewrites only local cache hosts', () => {
    expect(containerUrl('http://localhost:5000/path')).toBe(
      'http://host.docker.internal:5000/path'
    );
    expect(containerUrl('https://cache.example/path')).toBe('https://cache.example/path');
    expect(remoteCacheEnvironment()).toEqual([]);
    expect(remoteCacheEnvironment('http://127.0.0.1:5000/$cache')).toEqual([
      'TURBO_API=http://host.docker.internal:5000/$$cache',
      'TURBO_TEAM',
      'TURBO_TOKEN',
      'TURBO_REMOTE_CACHE_SIGNATURE_KEY'
    ]);
  });

  test.each([
    'ghcr.io/metorial/api:latest',
    'ghcr.io/other/api@sha256:' + 'a'.repeat(64),
    'ghcr.io/metorial/api@sha256:abc'
  ])('rejects unpinned %s', image => expect(isPinnedImage(image)).toBe(false));

  test('health failures include exited container logs', async () => {
    let value = fixture();
    let plan = buildPlan(value, discover(value.root), options());
    let compose = new Compose(value.root, '/fake');
    compose.output = async args =>
      args[0] === 'ps' ? 'app-stack' : args[0] === 'logs' ? 'fatal startup error' : '503';

    await expect(waitForHealth(compose, plan.suts, 1)).rejects.toThrow('fatal startup error');
    compose.output = async () => '204';

    await waitForHealth(compose, plan.suts, 1);
  });
});

describe('CI descriptions', () => {
  test('includes transitive images and never resolves secrets', () => {
    let root = temporary();
    packageFixture(
      root,
      'dependency',
      'dependency',
      "name='dependency'\n[[ci.images]]\nname='dependency'\n[dev.env]\nSECRET={required=true}"
    );
    packageFixture(
      root,
      'stack',
      'stack',
      "name='stack'\ndependencies=['dependency']\n[[ci.images]]\nname='stack'\n[e2e]\nimage='stack'\n[ci.suite]\nname='stack'\nrunner='compose'"
    );

    for (let name of ['dependency', 'stack'])
      atomicWrite(join(root, name, 'Dockerfile'), 'FROM scratch\n');

    let result = inventory(project(root));

    expect(result.suites[0]!.images).toEqual(['dependency', 'stack']);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });

  test('rejects escaping CI Dockerfiles and duplicate images', () => {
    let value = fixture();
    atomicWrite(
      join(value.root, 'stack/control.toml'),
      "name='stack'\n[[ci.images]]\nname='stack'\ndockerfile='../../outside'"
    );

    expect(() => inventory(value)).toThrow();
    atomicWrite(
      join(value.root, 'stack/control.toml'),
      "name='stack'\n[[ci.images]]\nname='stack'\n[[ci.images]]\nname='stack'"
    );
    atomicWrite(join(value.root, 'stack/Dockerfile'), 'FROM scratch\n');

    expect(() => inventory(value)).toThrow('duplicate');
  });
});
