import { expect, test } from 'bun:test';
import { affected, suites } from './changes';

test('unchanged and unrelated workspaces do not select tests', () => {
  expect(affected([], ['src/forge/service'], false)).toBe(false);
  expect(
    affected(
      ['docs/guide.md', 'src/nebula/service/src/index.ts'],
      ['src/forge/service'],
      false
    )
  ).toBe(false);
  expect(affected(['src/forge/service-other/index.ts'], ['src/forge/service'], false)).toBe(
    false
  );
});

test('source, shared dependency, deleted files and imported configuration select tests', () => {
  let directories = [
    'src/forge/service',
    'src/lowerdeck/packages/rpc-client',
    'src/shared/vitest.config.ts'
  ];
  for (let path of [
    'src/forge/service/src/deleted.ts',
    'src/lowerdeck/packages/rpc-client/src/index.ts',
    'src/shared/vitest.config.ts'
  ]) {
    expect(affected([path], directories, false)).toBe(true);
  }
  expect(affected([], directories, true)).toBe(true);
});

test('E2E suites include every application container dependency', () => {
  expect(suites.find(suite => suite.name === 'shuttle')!.services).toContain('forge');
  expect(suites.find(suite => suite.name === 'slates-hub')!.services).toEqual([
    'slates',
    'forge',
    'function-bay',
    'signal'
  ]);
  expect(suites.find(suite => suite.name === 'function-bay')!.services).toContain('forge');
});

test('control suites select stack test packages and prune them for CI', async () => {
  let { controlSuites, controlTestPackages, controlTasks } = await import('./changes');
  let packages = new Map([
    [
      '@metorial/module-user',
      { directory: 'src/metorial/products/core/modules/user', e2e: true }
    ],
    ['@metorial/api-core', { directory: 'src/metorial/apis/core', e2e: true }],
    ['@metorial/db', { directory: 'src/metorial/db', e2e: false }],
    ['@metorial/module-x', { directory: 'src/metorial/products/core/modules/x', e2e: false }]
  ]);
  expect(controlTestPackages(controlSuites.oss, packages)).toEqual([
    '@metorial/api-core',
    '@metorial/module-user'
  ]);
  expect(controlTasks(controlSuites.oss)).toBe(
    'prisma:generate test:e2e --filter=./src/metorial/products/*/modules/* --filter=./src/metorial/apis/*'
  );
  expect(controlSuites.enterprise.package).toBe('@metorial/mte-core-api');
});

test('unit selection follows Turbo input exclusions and external config globs', async () => {
  let { taskInputsChanged } = await import('./changes');
  let task = {
    directory: 'src/forge/service',
    resolvedTaskDefinition: {
      inputs: [
        '$TURBO_DEFAULT$',
        '!README*',
        '!Dockerfile',
        '../../../tsconfig*.json',
        '../../../shared/vitest.config.ts'
      ]
    }
  };
  for (let path of [
    'docs/guide.md',
    'src/forge/service/README.md',
    'src/forge/service/Dockerfile'
  ]) {
    expect(taskInputsChanged([path], task)).toBe(false);
  }
  for (let path of [
    'src/forge/service/src/new.ts',
    'src/forge/service/src/deleted.ts',
    'tsconfig.test.json',
    'shared/vitest.config.ts'
  ]) {
    expect(taskInputsChanged([path], task)).toBe(true);
  }
});

test('documentation exclusions preserve README test fixtures', async () => {
  let { testRelevantPaths } = await import('./changes');
  expect(
    testRelevantPaths(
      [
        'src/forge/service/README.md',
        'src/forge/service/fixtures/README.md',
        'src/tooling/test-ci/README.md'
      ],
      ['src/forge/service', 'src/tooling/test-ci']
    )
  ).toEqual(['src/forge/service/fixtures/README.md']);
});
