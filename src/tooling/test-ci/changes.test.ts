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
