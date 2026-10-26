import { existsSync, readFileSync } from 'node:fs';

export type E2EDurations = Record<string, number>;

export interface E2EShard {
  package: string;
  index: number;
  count: number;
}

export interface E2EGroup {
  packages: string[];
  shards: E2EShard[];
  seconds: number;
}

export let DEFAULT_E2E_DURATION_SECONDS = 60;

export let readE2EDurations = (path: string): E2EDurations =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};

let median = (values: number[]) => {
  if (!values.length) return DEFAULT_E2E_DURATION_SECONDS;
  let sorted = [...values].sort((a, b) => a - b);
  let middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/**
 * Splits e2e test packages into `groups` duration-balanced groups (longest processing time
 * first). Each group runs `concurrency` packages at once, so its wall time is bounded below by
 * its longest package; a package longer than a group's expected wall time is split by test
 * file into Vitest shards, each placed in a different group.
 */
export let planE2EGroups = (
  packages: string[],
  durations: E2EDurations,
  groups: number,
  concurrency = 1
): E2EGroup[] => {
  let known = packages.map(name => durations[name]).filter(value => value !== undefined);
  let fallback = median(known);
  let durationOf = (name: string) => durations[name] ?? fallback;

  let total = packages.reduce((sum, name) => sum + durationOf(name), 0);
  let count = Math.max(1, Math.min(groups, packages.length));
  let target = total / (count * Math.max(1, concurrency));

  let units = packages.flatMap<{
    package: string;
    seconds: number;
    shard: E2EShard | undefined;
  }>(name => {
    let seconds = durationOf(name);
    let shards = count > 1 ? Math.min(count, Math.ceil(seconds / target)) : 1;
    if (shards <= 1) return [{ package: name, seconds, shard: undefined }];

    return Array.from({ length: shards }, (_, index) => ({
      package: name,
      seconds: seconds / shards,
      shard: { package: name, index: index + 1, count: shards }
    }));
  });
  units.sort((a, b) => b.seconds - a.seconds || a.package.localeCompare(b.package));

  let planned: E2EGroup[] = Array.from({ length: count }, () => ({
    packages: [],
    shards: [],
    seconds: 0
  }));
  for (let unit of units) {
    let candidates = planned.filter(
      group => !unit.shard || !group.shards.some(shard => shard.package === unit.package)
    );
    let group = candidates.reduce((least, current) =>
      current.seconds < least.seconds ? current : least
    );
    if (unit.shard) group.shards.push(unit.shard);
    else group.packages.push(unit.package);
    group.seconds += unit.seconds;
  }

  return planned
    .filter(group => group.packages.length || group.shards.length)
    .map(group => ({
      ...group,
      packages: group.packages.sort(),
      shards: group.shards.sort((a, b) => a.package.localeCompare(b.package))
    }));
};

/** Arguments after `control test:e2e`: the group's test packages, then its per-package shards. */
export let e2eGroupArgs = (group: E2EGroup) => {
  let filters = [...group.packages, ...group.shards.map(shard => shard.package)];
  let shards = group.shards.map(
    shard => `--package-shard=${shard.package}=${shard.index}/${shard.count}`
  );
  return [...filters, ...(shards.length ? ['--', ...shards] : [])].join(' ');
};

let durationPattern = /(@[^\s:]+\/[^\s:]+):test:e2e:\s+Duration\s+([\d.]+)(ms|s)\b/;

/**
 * Reads per-package Vitest durations from `control test:e2e` output (local logs or downloaded
 * CI job logs). Shards of one package are summed, so the logs of every group of one run can be
 * passed together.
 */
export let parseE2EDurations = (logs: string[]): E2EDurations => {
  let durations: E2EDurations = {};
  for (let log of logs) {
    for (let line of log.replace(/\x1b\[[0-9;]*m/g, '').split('\n')) {
      let match = line.match(durationPattern);
      if (!match) continue;
      let seconds = Number(match[2]) / (match[3] === 'ms' ? 1000 : 1);
      durations[match[1]!] = (durations[match[1]!] ?? 0) + seconds;
    }
  }
  return durations;
};

if (import.meta.main) {
  let [command, output, ...logPaths] = process.argv.slice(2);
  if (command !== 'update' || !output || !logPaths.length) {
    console.error('Usage: bun e2e-groups.ts update <durations.json> <log> [log...]');
    process.exit(1);
  }

  let measured = parseE2EDurations(logPaths.map(path => readFileSync(path, 'utf8')));
  let merged = { ...readE2EDurations(output) };
  for (let [name, seconds] of Object.entries(measured)) merged[name] = Math.round(seconds);
  let sorted = Object.fromEntries(
    Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))
  );

  await Bun.write(output, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Updated ${Object.keys(measured).length} package duration(s) in ${output}`);
}
