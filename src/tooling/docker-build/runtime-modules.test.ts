import { afterEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRuntimeModules, packageRootOf } from './runtime-modules';

let directories: string[] = [];

afterEach(() => {
  for (let directory of directories) rmSync(directory, { recursive: true, force: true });

  directories = [];
});

let workspace = (files: Record<string, string>) => {
  let root = realpathSync(mkdtempSync(join(tmpdir(), 'runtime-modules-')));
  directories.push(root);

  for (let [path, contents] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), contents);
  }

  return root;
};

let packageJson = (name: string, version: string, dependencies: Record<string, string> = {}) =>
  JSON.stringify({ name, version, main: 'index.js', dependencies });

let bundleManifest = (inputs: string[], externals: string[] = []) =>
  JSON.stringify({ version: 1, inputs, externals });

let files = (root: string, directory = ''): string[] =>
  readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? files(root, join(directory, entry.name))
      : [join(directory, entry.name)]
  );

test('finds the package directory below the last node_modules', () => {
  expect(packageRootOf('/app/node_modules/pg/lib/native/client.js')).toBe(
    '/app/node_modules/pg'
  );
  expect(packageRootOf('/app/node_modules/@aws-sdk/core/dist/index.js')).toBe(
    '/app/node_modules/@aws-sdk/core'
  );
  expect(packageRootOf('/app/node_modules/bullmq/node_modules/tslib/tslib.es6.mjs')).toBe(
    '/app/node_modules/bullmq/node_modules/tslib'
  );
  expect(packageRootOf('/app/src/main.ts')).toBeUndefined();
});

test('keeps manifests of bundled packages and whole packages loaded at runtime', () => {
  let root = workspace({
    'node_modules/pg/package.json': packageJson('pg', '8.16.0'),
    'node_modules/pg/lib/index.js': 'module.exports = {};',
    'node_modules/pg/lib/package.json': '{"type":"commonjs"}',
    'node_modules/bullmq/package.json': packageJson('bullmq', '5.0.0'),
    'node_modules/bullmq/index.js': '',
    'node_modules/bullmq/node_modules/tslib/package.json': packageJson('tslib', '2.4.0'),
    'node_modules/bullmq/node_modules/tslib/tslib.js': '',
    'node_modules/@aws-sdk/client-s3/package.json': packageJson(
      '@aws-sdk/client-s3',
      '3.0.0',
      {
        '@smithy/core': '^3',
        'fast-xml-parser': '^5'
      }
    ),
    'node_modules/@aws-sdk/client-s3/index.js': '',
    'node_modules/@aws-sdk/client-s3/node_modules/fast-xml-parser/package.json': packageJson(
      'fast-xml-parser',
      '5.0.0'
    ),
    'node_modules/@smithy/core/package.json': packageJson('@smithy/core', '3.0.0'),
    'node_modules/@smithy/core/index.js': '',
    'node_modules/vite/package.json': packageJson('vite', '7.0.0'),
    'node_modules/vite/index.js': '',
    'oss/packages/legacy/node_modules/left-pad/package.json': packageJson('left-pad', '1.0.0'),
    'oss/packages/legacy/node_modules/left-pad/index.js': '',
    'service/dist/main.mjs': '',
    'service/dist/bundle-manifest/main.json': bundleManifest(
      [
        '../../src/main.ts',
        '../../../node_modules/pg/lib/index.js',
        '../../../node_modules/bullmq/index.js',
        '../../../node_modules/bullmq/node_modules/tslib/tslib.js',
        '../../../node_modules/@smithy/core/index.js',
        '../../../oss/packages/legacy/node_modules/left-pad/index.js'
      ],
      [
        'node:fs',
        'fs',
        'bun',
        '@aws-sdk/client-s3/commands',
        'pg-native',
        '../build/zstd.node'
      ]
    )
  });

  let result = buildRuntimeModules({
    nodeModules: join(root, 'node_modules'),
    out: join(root, 'out'),
    manifestDirectories: [join(root, 'service/dist')]
  });

  expect(result.runtime).toEqual([
    '@aws-sdk/client-s3',
    '@aws-sdk/client-s3/node_modules/fast-xml-parser',
    '@smithy/core'
  ]);
  expect(result.bundled).toEqual([
    '.workspaces/oss/packages/legacy/node_modules/left-pad',
    'bullmq',
    'bullmq/node_modules/tslib',
    'pg'
  ]);
  expect(result.unresolved).toEqual(['pg-native']);

  expect(files(join(root, 'out')).sort()).toEqual([
    '.workspaces/oss/packages/legacy/node_modules/left-pad/package.json',
    '@aws-sdk/client-s3/index.js',
    '@aws-sdk/client-s3/node_modules/fast-xml-parser/package.json',
    '@aws-sdk/client-s3/package.json',
    '@smithy/core/index.js',
    '@smithy/core/package.json',
    'bullmq/node_modules/tslib/package.json',
    'bullmq/package.json',
    'pg/package.json'
  ]);

  expect(existsSync(join(root, 'service/dist/bundle-manifest'))).toBe(false);
  expect(existsSync(join(root, 'service/dist/main.mjs'))).toBe(true);
});

test('reads bundle manifests of asset directories', () => {
  let root = workspace({
    'node_modules/dompurify/package.json': packageJson('dompurify', '3.0.0'),
    'node_modules/dompurify/dist/purify.js': '',
    'service/dist/bundle-manifest/main.json': bundleManifest([]),
    'frontend/dist/index.html': '',
    'frontend/dist/bundle-manifest/vite.json': bundleManifest([
      '../../../node_modules/dompurify/dist/purify.js'
    ])
  });

  let result = buildRuntimeModules({
    nodeModules: join(root, 'node_modules'),
    out: join(root, 'out'),
    manifestDirectories: [join(root, 'service/dist'), join(root, 'frontend/dist')]
  });

  expect(result.bundled).toEqual(['dompurify']);
  expect(existsSync(join(root, 'frontend/dist/bundle-manifest'))).toBe(false);
});

test('refuses a build without a bundle manifest', () => {
  let root = workspace({ 'node_modules/.keep': '', 'service/dist/main.mjs': '' });

  expect(() =>
    buildRuntimeModules({
      nodeModules: join(root, 'node_modules'),
      out: join(root, 'out'),
      manifestDirectories: [join(root, 'service/dist')]
    })
  ).toThrow('--bundle-manifest');
});

test('refuses a bundle built against another install', () => {
  let root = workspace({
    'node_modules/.keep': '',
    'service/dist/bundle-manifest/main.json': bundleManifest([
      '../../../node_modules/removed/index.js'
    ])
  });

  expect(() =>
    buildRuntimeModules({
      nodeModules: join(root, 'node_modules'),
      out: join(root, 'out'),
      manifestDirectories: [join(root, 'service/dist')]
    })
  ).toThrow('missing from the install');
});
