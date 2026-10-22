import { expect, test } from 'bun:test';
import { affected, controlTasks, suites } from './changes';

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
  expect(controlTasks(controlSuites.enterprise)).toBe(
    'prisma:generate test:e2e --filter=./src/metorial/modules/* --filter=./src/metorial/apis/* --filter=@metorial-enterprise/fabric'
  );
  expect(controlSuites.enterprise.package).toBe('@metorial/mte-core-api');
});

test('control suites run as duration-balanced matrix groups with per-package shards', async () => {
  let { controlSuites, controlMatrix } = await import('./changes');
  let packages = new Map([
    ['@metorial/api-core', { directory: 'src/metorial/apis/core', e2e: true }],
    ...Array.from(
      { length: 8 },
      (_, index) =>
        [
          `@metorial/module-m${index}`,
          { directory: `src/metorial/products/core/modules/m${index}`, e2e: true }
        ] as const
    )
  ]);
  let durations: Record<string, number> = { '@metorial/api-core': 600 };
  for (let index = 0; index < 8; index++) durations[`@metorial/module-m${index}`] = 50;

  let matrix = controlMatrix(controlSuites.oss, packages, durations);

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
      tasks: controlTasks(controlSuites.oss)
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
  expect(controlMatrix(controlSuites.oss, single, {})).toEqual([
    expect.objectContaining({ name: 'metorial', key: 'metorial', args: '@metorial/api-core' })
  ]);
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
