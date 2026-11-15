import { describe, expect, test } from 'bun:test';
import { resolvePackageShardArgs } from './shard';

describe('resolvePackageShardArgs', () => {
  test('turns the shard addressed to this package into a Vitest shard', () => {
    expect(
      resolvePackageShardArgs(
        ['--package-shard=@metorial/api-core=2/3', '-t', 'boots'],
        '@metorial/api-core'
      )
    ).toEqual(['-t', 'boots', '--shard=2/3', '--passWithNoTests']);
  });

  test('drops shards addressed to other packages', () => {
    expect(
      resolvePackageShardArgs(
        ['--package-shard=@metorial/api-core=1/2', 'e2e/users.e2e.ts'],
        '@metorial/module-user'
      )
    ).toEqual(['e2e/users.e2e.ts']);
  });

  test('leaves arguments without shards unchanged', () => {
    expect(resolvePackageShardArgs([], '@metorial/api-core')).toEqual([]);
    expect(resolvePackageShardArgs(['-t', 'x'], '@metorial/api-core')).toEqual(['-t', 'x']);
  });

  test('rejects malformed shard arguments', () => {
    for (let arg of [
      '--package-shard=@metorial/api-core',
      '--package-shard=@metorial/api-core=two/3',
      '--package-shard==1/2'
    ]) {
      expect(() => resolvePackageShardArgs([arg], '@metorial/api-core')).toThrow();
    }
  });
});
