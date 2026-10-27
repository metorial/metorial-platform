import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { atomicWrite, writeJson } from '../src/files';
import * as manifest from '../src/manifest';
import { packageFixture, temporary } from './helpers';

let fixture = (text: string) => {
  let root = temporary();
  packageFixture(root, '', 'api', text, {
    'dev:start': 'true',
    'e2e:start': 'true',
    'control:db:generate': 'true',
    'control:db:push': 'true'
  });

  return { root, path: join(root, 'control.toml') };
};

describe('strict manifest validation', () => {
  test.each([
    ['unexpected=true', 'unknown field'],
    ["name='api'\n[dev]\nunexpected=true", 'unknown field'],
    ["name='api'\nmode='invalid'", 'invalid'],
    ["name='api'\n[dev.env]\nKEY=false", 'booleans may only be true'],
    ["name='api'\n[dev.env]\nKEY={value='x',from='Y'}", 'both value and from'],
    ["name='api'\n[dev.env]\n'BAD-KEY'='x'", 'invalid environment key'],
    ["name='api'\n[package]\nname='also'", 'use either'],
    ["name=''", 'cannot be empty'],
    ["name='api'\n[dev]\nrun=['absent']", 'required script'],
    ["name='api'\n[dev]\nrun=['echo hi']", 'invalid package script'],
    ["name='api'\n[[dev.expose]]\nport=0", 'cannot be zero'],
    ["name='api'\n[[dev.expose]]\nport=123\n[[dev.expose]]\nport=123", 'duplicate'],
    ["name='api'\n[endpoints.http]\nport=65536", 'invalid'],
    ["name='api'\n[endpoints.http]\nport=123\nhealth='ping'", "must start with '/'"],
    [
      "name='api'\n[endpoints.http]\nport=123\nhealth={path='/',status=42}",
      'status 42 is invalid'
    ],
    ["name='api'\n[[health]]\nport=0\npath='/'", 'cannot be zero'],
    ["name='api'\n[e2e]\nimage='App_Api'", 'invalid e2e image'],
    ["name='api'\n[e2e]\nservices=['worker']", 'require e2e tests'],
    ["name='api'\n[e2e]\ntests=['/absolute']", 'relative package directory'],
    ["name='api'\n[e2e]\ntests=['../*']\nhealth_timeout=0", 'cannot be zero'],
    ["[e2e]\nstart=['e2e:start']", 'requires a named package'],
    ['[endpoints.http]\nport=123', 'require a named package'],
    ["name='api'\n[run.dev]\ncommand='x'\ndepends_on=['missing']", 'unknown local run'],
    [
      "name='api'\n[postgres.DB]\npackage='api'\ndatabase=\"bad'quote\"",
      'invalid postgres database'
    ],
    [
      "name='api'\n[dev.env]\nPORT='1'\n[endpoints.http]\nport=123\nenv=[{key='PORT',value='{{PORT}}'}]",
      'declared by both'
    ],
    [
      "name='api'\n[[resources]]\ntype='redis'\nenv=[{key='REDIS',value='{{UNKNOWN}}'}]",
      'unknown template'
    ],
    [
      "name='api'\n[[resources]]\ntype='redis'\nenv=[{key='REDIS',value='{{HOSTNAME'}]",
      'unclosed template'
    ]
  ])('rejects %s', (text, error) => {
    let { path } = fixture(text);

    expect(() => manifest.load(path)).toThrow(error);
  });

  test('normalizes both supported schemas and database defaults', () => {
    let { path } = fixture(
      "name='api'\ngroup='backend'\n[dev]\nrun=['dev:start','e2e:start']\nprepare=['build']\ncleanup=['echo bye']\n[[dev.expose]]\nport=4310\n[dev.db.main]\nname='app'\nengine='postgres'\nenv='DB'\npackage='api'"
    );
    let parsed = manifest.load(path).manifest;

    expect(parsed.package).toEqual({ name: 'api', groups: ['backend'] });
    expect(parsed.run.dev!.command).toBe('bun run dev:start');
    expect(parsed.run['2']!.command).toBe('bun run e2e:start');
    expect(parsed.endpoints.http!.port).toBe(4310);

    expect(parsed.postgres.DB).toMatchObject({
      host: '127.0.0.1',
      port: 35432,
      service: 'postgres-db2',
      user: 'postgres'
    });
    expect(parsed.cleanup.commands).toEqual(['echo bye']);
  });
});

describe('manifest graphs and selection', () => {
  test('discovers in component lexical order and excludes generated trees', () => {
    let root = temporary();

    for (let directory of [
      'api',
      'api-client',
      'out/copy',
      '.control/copy',
      'node_modules/copy',
      'target/copy'
    ])
      packageFixture(root, directory, directory, `name='${directory}'`);

    expect(manifest.discover(root).map(item => item.manifest.package!.name)).toEqual([
      'api',
      'api-client'
    ]);
  });

  test.each([
    ["name='a'\ndependencies=['missing']", 'unknown dependency'],
    ["name='a'\ndependencies=['a']", 'itself'],
    ["name='a'\ndependencies=['b']", 'dependency cycle'],
    ["name='a'\nmode='both'\ndependencies=['b']", 'incompatible mode']
  ])('rejects invalid graph %s', (text, expected) => {
    let root = temporary();
    packageFixture(root, 'a', 'a', text);
    packageFixture(
      root,
      'b',
      'b',
      expected === 'incompatible mode'
        ? "name='b'\nmode='enterprise'"
        : "name='b'\ndependencies=['a']"
    );

    expect(() => manifest.discover(root)).toThrow(expected);
  });

  test('orders transitive start dependencies and stops at externals', () => {
    let root = temporary();
    packageFixture(root, '', 'root', "[groups]\nall=['a']");
    packageFixture(root, 'a', 'a', "name='a'\ngroup='apps'\ndependencies=['b']");
    packageFixture(root, 'b', 'b', "name='b'\ndependencies=['c']");

    packageFixture(root, 'c', 'c', "name='c'");

    let all = manifest.discover(root);
    let selected = manifest.selectWithDependencies(all, ['apps'], 'oss');

    expect(selected.map(item => item.manifest.package?.name)).toEqual([
      undefined,
      'c',
      'b',
      'a'
    ]);
    expect(
      manifest
        .selectWithDependencies(all, ['all'], 'oss', new Set(['b']))
        .map(item => item.manifest.package?.name)
    ).toEqual([undefined, 'a']);
    expect(() => manifest.select(all, ['unknown'], 'oss')).toThrow('unknown package/group');
  });

  test('non-starting endpoint references create no cycle or closure edge', () => {
    let root = temporary();
    packageFixture(root, 'a', 'a', "name='a'\n[[dependencies]]\nidentifier='b'\nstart=false");
    packageFixture(root, 'b', 'b', "name='b'\ndependencies=['a']");

    let all = manifest.discover(root);

    expect(
      manifest
        .selectWithDependencies(all, ['a'], 'oss')
        .map(item => item.manifest.package!.name)
    ).toEqual(['a']);
  });

  test('validates referenced database owner scripts', () => {
    let root = temporary();
    packageFixture(
      root,
      'api',
      'api',
      "name='api'\n[dev.db.main]\nname='app'\nengine='mongo'\nenv='DB'\npackage='db'"
    );

    expect(() => manifest.discover(root)).toThrow('unknown npm package');
    packageFixture(root, 'db', 'db');

    expect(() => manifest.discover(root)).toThrow('required script');
    writeJson(join(root, 'db/package.json'), {
      name: 'db',
      scripts: { 'control:db:generate': 'x', 'control:db:push': 'x' }
    });

    expect(manifest.discover(root)).toHaveLength(1);
  });

  test('external endpoint mappings are strict and override consumers', () => {
    let root = temporary();
    packageFixture(
      root,
      'a',
      'a',
      "name='a'\n[[dependencies]]\nidentifier='b'\nenv=[{endpoint='http',key='URL',value='http://{{HOSTNAME}}:{{PORT}}'}]"
    );
    packageFixture(root, 'b', 'b', "name='b'\n[endpoints.http]\nport=4310");

    let all = manifest.discover(root);
    atomicWrite(
      join(root, 'control-external.toml'),
      "[[external]]\nidentifier='b'\nhostname='services'\n[external.mapping]\nhttp=51000"
    );

    expect([...manifest.loadExternals(root, all)]).toEqual(['b']);
    expect(all[0]!.manifest.dependency_endpoints.b!.http).toEqual({
      hostname: 'services',
      port: 51000
    });
    atomicWrite(
      join(root, 'control-external.toml'),
      "[[external]]\nidentifier='b'\nhostname='services'"
    );

    expect(() => manifest.loadExternals(root, all)).toThrow('missing mapping');
  });
});
