import { expect, test } from 'bun:test';
import { affected, controlSuites, controlTasks } from './changes';

let controlSuiteFixtures = {
  oss: {
    name: 'metorial',
    package: '@metorial/app-api',
    stackPackages: [],
    workspacePackages: [],
    services: [],
    tests: [
      'src/metorial/products/*/modules/*',
      'src/platform/modules/*',
      'src/products/*/modules/*',
      'src/products/*/apis/*',
      'src/metorial/apis/*'
    ],
    groups: 4
  },
  enterprise: {
    name: 'metorial-enterprise',
    package: '@metorial/mte-core-api',
    stackPackages: [],
    workspacePackages: ['@metorial-enterprise/fabric'],
    services: [],
    tests: ['src/metorial/modules/*', 'src/metorial/apis/*'],
    groups: 2
  }
};

test('unchanged and unrelated workspaces do not select tests', () => {
  expect(affected([], ['src/products/runtime/services/build/service'], false)).toBe(false);
  expect(
    affected(
      ['docs/guide.md', 'src/platform/services/secret-store/service/src/index.ts'],
      ['src/products/runtime/services/build/service'],
      false
    )
  ).toBe(false);
  expect(
    affected(
      ['src/products/runtime/services/build/service-other/index.ts'],
      ['src/products/runtime/services/build/service'],
      false
    )
  ).toBe(false);
});

test('source, shared dependency, deleted files and imported configuration select tests', () => {
  let directories = [
    'src/products/runtime/services/build/service',
    'src/lib/rpc/node/client',
    'src/shared/vitest.config.ts'
  ];
  for (let path of [
    'src/products/runtime/services/build/service/src/deleted.ts',
    'src/lib/rpc/node/client/src/index.ts',
    'src/shared/vitest.config.ts'
  ]) {
    expect(affected([path], directories, false)).toBe(true);
  }
  expect(affected([], directories, true)).toBe(true);
});

test('E2E suites include every application container dependency', () => {
  expect(controlSuites.find(suite => suite.name === 'mcp-runtime')!.services).toContain(
    '@mtsrc/build-service'
  );
  expect(controlSuites.find(suite => suite.name === 'functions')!.services).toContain(
    '@mtsrc/build-service'
  );
});

test('MCP Runtime and Functions control suites include Build as a stack dependency', () => {
  for (let name of ['mcp-runtime', 'functions']) {
    expect(controlSuites.find(suite => suite.name === name)).toMatchObject({
      stackPackages: expect.arrayContaining(['@mtsrc/build-service'])
    });
  }
});

test('control suites select stack test packages and prune them for CI', async () => {
  let { controlTestPackages, controlTasks } = await import('./changes');
  let packages = new Map([
    ['@metorial/module-user', { directory: 'src/products/identity/modules/user', e2e: true }],
    ['@metorial/api-core', { directory: 'src/metorial/apis/core', e2e: true }],
    [
      '@metorial/api-outpost',
      { directory: 'src/products/outpost/apis/outpost-api', e2e: true }
    ],
    ['@metorial/db', { directory: 'src/metorial/db', e2e: false }],
    ['@metorial/module-x', { directory: 'src/platform/modules/x', e2e: false }]
  ]);
  expect(controlTestPackages(controlSuiteFixtures.oss, packages)).toEqual([
    '@metorial/api-core',
    '@metorial/api-outpost',
    '@metorial/module-user'
  ]);
  expect(controlTasks(controlSuiteFixtures.oss)).toBe(
    'prisma:generate test:e2e --filter=./src/metorial/products/*/modules/* --filter=./src/platform/modules/* --filter=./src/products/*/modules/* --filter=./src/products/*/apis/* --filter=./src/metorial/apis/*'
  );
  expect(controlTasks(controlSuiteFixtures.enterprise)).toBe(
    'prisma:generate test:e2e --filter=./src/metorial/modules/* --filter=./src/metorial/apis/* --filter=@metorial-enterprise/fabric'
  );
  expect(controlSuiteFixtures.enterprise.package).toBe('@metorial/mte-core-api');
});

test('control suites run as duration-balanced matrix groups with per-package shards', async () => {
  let { controlMatrix } = await import('./changes');
  let packages = new Map([
    ['@metorial/api-core', { directory: 'src/metorial/apis/core', e2e: true }],
    ...Array.from(
      { length: 8 },
      (_, index) =>
        [
          `@metorial/module-m${index}`,
          { directory: `src/platform/modules/m${index}`, e2e: true }
        ] as const
    )
  ]);
  let durations: Record<string, number> = { '@metorial/api-core': 600 };
  for (let index = 0; index < 8; index++) durations[`@metorial/module-m${index}`] = 50;

  let matrix = controlMatrix(controlSuiteFixtures.oss, packages, durations);

  expect(matrix.map(entry => entry.name)).toEqual([
    'metorial 1/4',
    'metorial 2/4',
    'metorial 3/4',
    'metorial 4/4'
  ]);
  expect(new Set(matrix.map(entry => entry.key)).size).toBe(4);
  for (let entry of matrix) {
    expect(entry).toMatchObject({
      control: true,
      package: '@metorial/app-api',
      workspace: '.',
      tasks: controlTasks(controlSuiteFixtures.oss)
    });
    expect(entry.args).toMatch(
      /^@metorial\/[\w-]+( @metorial\/[\w-]+)*( -- --package-shard=.+)?$/
    );
  }
  let shardArgs = matrix.flatMap(entry => entry.args.match(/--package-shard=\S+/g) ?? []);
  expect(shardArgs.sort()).toEqual([
    '--package-shard=@metorial/api-core=1/4',
    '--package-shard=@metorial/api-core=2/4',
    '--package-shard=@metorial/api-core=3/4',
    '--package-shard=@metorial/api-core=4/4'
  ]);

  let single = new Map([...packages].slice(0, 1));
  expect(controlMatrix(controlSuiteFixtures.oss, single, {})).toEqual([
    expect.objectContaining({ name: 'metorial', key: 'metorial', args: '@metorial/api-core' })
  ]);
});

test('unit selection follows Turbo input exclusions and external config globs', async () => {
  let { taskInputsChanged } = await import('./changes');
  let task = {
    directory: 'src/products/runtime/services/build/service',
    resolvedTaskDefinition: {
      inputs: [
        '$TURBO_DEFAULT$',
        '!README*',
        '!Dockerfile',
        '../../../../../../tsconfig*.json',
        '../../../../../../shared/vitest.config.ts'
      ]
    }
  };
  for (let path of [
    'docs/guide.md',
    'src/products/runtime/services/build/service/README.md',
    'src/products/runtime/services/build/service/Dockerfile'
  ]) {
    expect(taskInputsChanged([path], task)).toBe(false);
  }
  for (let path of [
    'src/products/runtime/services/build/service/src/new.ts',
    'src/products/runtime/services/build/service/src/deleted.ts',
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
        'src/products/runtime/services/build/service/README.md',
        'src/products/runtime/services/build/service/fixtures/README.md',
        'src/tooling/test-ci/README.md'
      ],
      ['src/products/runtime/services/build/service', 'src/tooling/test-ci']
    )
  ).toEqual(['src/products/runtime/services/build/service/fixtures/README.md']);
});
