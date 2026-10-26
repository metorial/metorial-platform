import { expect, test } from 'bun:test';
import { e2eGroupArgs, parseE2EDurations, planE2EGroups } from './e2e-groups';

let names = (count: number) => Array.from({ length: count }, (_, index) => `@x/p${index}`);

test('balances packages across groups by duration', () => {
  let durations = { '@x/a': 50, '@x/b': 40, '@x/c': 30, '@x/d': 20, '@x/e': 10, '@x/f': 10 };
  let groups = planE2EGroups(Object.keys(durations), durations, 2);

  expect(groups.map(group => group.seconds).sort()).toEqual([80, 80]);
  expect(groups.flatMap(group => group.packages).sort()).toEqual(
    Object.keys(durations).sort()
  );
  expect(groups.every(group => group.shards.length === 0)).toBe(true);
});

test('shards a package longer than an even share across different groups', () => {
  let durations: Record<string, number> = { '@x/huge': 600 };
  for (let name of names(10)) durations[name] = 30;
  let groups = planE2EGroups(Object.keys(durations), durations, 4);

  expect(groups).toHaveLength(4);
  let shards = groups.flatMap(group => group.shards);
  expect(shards.map(shard => `${shard.index}/${shard.count}`).sort()).toEqual([
    '1/3',
    '2/3',
    '3/3'
  ]);
  for (let group of groups) {
    expect(group.shards.length).toBeLessThanOrEqual(1);
    expect(group.packages).not.toContain('@x/huge');
  }
  expect(Math.max(...groups.map(group => group.seconds))).toBeLessThanOrEqual(240);
});

test('shards packages that would outlast a concurrent group on their own', () => {
  let durations: Record<string, number> = { '@x/huge': 300, '@x/long': 100 };
  for (let name of names(16)) durations[name] = 15;
  let total = 640;

  expect(planE2EGroups(Object.keys(durations), durations, 2).flatMap(g => g.shards)).toEqual(
    []
  );

  let groups = planE2EGroups(Object.keys(durations), durations, 2, 4);
  let wallTime = total / (2 * 4);
  expect(
    groups
      .flatMap(group => group.shards)
      .map(shard => shard.package)
      .sort()
  ).toEqual(['@x/huge', '@x/huge', '@x/long', '@x/long']);
  for (let group of groups) {
    let longest = Math.max(
      ...group.packages.map(name => durations[name]!),
      ...group.shards.map(shard => durations[shard.package]! / shard.count)
    );
    expect(longest).toBeLessThanOrEqual(wallTime * 2);
  }
});

test('uses the median for packages without a measured duration', () => {
  let [group] = planE2EGroups(['@x/a', '@x/b', '@x/new'], { '@x/a': 10, '@x/b': 30 }, 1);

  expect(group!.seconds).toBe(60);
  expect(planE2EGroups(['@x/new'], {}, 1)[0]!.seconds).toBe(60);
});

test('never plans more groups than packages, nor shards in a single group', () => {
  expect(planE2EGroups(['@x/a', '@x/b'], { '@x/a': 1000, '@x/b': 1 }, 4)).toHaveLength(2);

  let single = planE2EGroups(['@x/a', '@x/b'], { '@x/a': 1000, '@x/b': 1 }, 1);
  expect(single).toEqual([{ packages: ['@x/a', '@x/b'], shards: [], seconds: 1001 }]);
  expect(planE2EGroups([], {}, 4)).toEqual([]);
});

test('passes group packages as control filters and shards after --', () => {
  expect(e2eGroupArgs({ packages: ['@x/a', '@x/b'], shards: [], seconds: 0 })).toBe(
    '@x/a @x/b'
  );
  expect(
    e2eGroupArgs({
      packages: ['@x/a'],
      shards: [{ package: '@x/huge', index: 2, count: 3 }],
      seconds: 0
    })
  ).toBe('@x/a @x/huge -- --package-shard=@x/huge=2/3');
});

test('reads durations from control output and sums shards of one package', () => {
  let group = [
    '\x1b[2m@metorial/api-core:test:e2e: \x1b[22m   Duration  300.50s (tests 87%)',
    '@metorial/module-user:test:e2e:    Duration  850ms (tests 50%)',
    '@metorial/module-user:test:e2e:       Tests  3 passed (3)'
  ].join('\n');
  let other = '2026-10-22T09:00:00Z @metorial/api-core:test:e2e:    Duration  299.50s';

  expect(parseE2EDurations([group, other])).toEqual({
    '@metorial/api-core': 600,
    '@metorial/module-user': 0.85
  });
});
