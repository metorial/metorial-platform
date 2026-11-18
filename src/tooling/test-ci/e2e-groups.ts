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

/** What one group of a run measured, and which `<index>/<count>` shard of a package it ran. */
export interface E2EGroupMeasurement {
  durations: E2EDurations;
  shards: Record<string, string>;
}

export let DEFAULT_E2E_DURATION_SECONDS = 60;

/** Committed per-package baseline of the checkout this runs in; refreshed with `update`. */
export let E2E_DURATIONS_PATH = '.github/e2e-durations.json';

/**
 * Durations measured by the latest complete run on the default branch, restored from the
 * Actions cache before planning. They take precedence over the committed baseline.
 */
export let E2E_MEASURED_DURATIONS_PATH = '.github/e2e-durations.measured.json';

/** Test packages a stack runs at once; the `control-e2e` action reads it for `--concurrency`. */
export let CONTROL_E2E_CONCURRENCY = 1;

let packageShardPrefix = '--package-shard=';

export let readE2EDurations = (path: string): E2EDurations =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};

let readMeasuredE2EDurations = (): E2EDurations => {
  try {
    return readE2EDurations(E2E_MEASURED_DURATIONS_PATH);
  } catch (error) {
    console.warn(`Ignoring unreadable ${E2E_MEASURED_DURATIONS_PATH}:`, error);
    return {};
  }
};

export let readPlanningE2EDurations = (): E2EDurations => ({
  ...readE2EDurations(E2E_DURATIONS_PATH),
  ...readMeasuredE2EDurations()
});

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
    shard => `${packageShardPrefix}${shard.package}=${shard.index}/${shard.count}`
  );
  return [...filters, ...(shards.length ? ['--', ...shards] : [])].join(' ');
};

/** The package shards that arguments built by `e2eGroupArgs` select. */
export let parseE2EGroupShards = (args: string): Record<string, string> =>
  Object.fromEntries(
    args
      .split(/\s+/)
      .filter(arg => arg.startsWith(packageShardPrefix))
      .map(arg => {
        let spec = arg.slice(packageShardPrefix.length);
        let separator = spec.lastIndexOf('=');
        return [spec.slice(0, separator), spec.slice(separator + 1)];
      })
  );

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

/** Adds up the durations each group of one run measured; a sharded package appears in several. */
export let sumE2EDurations = (groups: E2EDurations[]): E2EDurations => {
  let durations: E2EDurations = {};
  for (let group of groups) {
    for (let [name, seconds] of Object.entries(group))
      durations[name] = (durations[name] ?? 0) + seconds;
  }
  return durations;
};

/**
 * Adds up what every group of one run measured. A sharded package only counts once all of its
 * shards reported: a partial sum would pass for a short package and stop it being sharded.
 */
export let mergeE2EGroupMeasurements = (groups: E2EGroupMeasurement[]) => {
  let durations = sumE2EDurations(groups.map(group => group.durations));

  let reported = new Map<string, { count: number; indexes: Set<string> }>();
  for (let group of groups) {
    for (let [name, shard] of Object.entries(group.shards)) {
      let [index = '', count = ''] = shard.split('/');
      let entry = reported.get(name) ?? { count: 0, indexes: new Set<string>() };
      entry.count = Math.max(entry.count, Number(count));
      entry.indexes.add(index);
      reported.set(name, entry);
    }
  }

  let incomplete = [...reported]
    .filter(([, entry]) => entry.indexes.size < entry.count)
    .map(([name]) => name)
    .sort();
  for (let name of incomplete) delete durations[name];

  return { durations, incomplete };
};

let readE2EGroupMeasurement = (path: string): E2EGroupMeasurement => {
  let value = JSON.parse(readFileSync(path, 'utf8'));
  return { durations: value.durations ?? {}, shards: value.shards ?? {} };
};

let writeE2EDurations = async (output: string, measured: E2EDurations) => {
  let merged = { ...readE2EDurations(output) };
  for (let [name, seconds] of Object.entries(measured)) merged[name] = Math.round(seconds);
  let sorted = Object.fromEntries(
    Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))
  );

  await Bun.write(output, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Updated ${Object.keys(measured).length} package duration(s) in ${output}`);
};

if (import.meta.main) {
  let [command, output, ...inputPaths] = process.argv.slice(2);
  let readLogs = () => inputPaths.map(path => readFileSync(path, 'utf8'));

  if (command === 'concurrency') {
    console.log(CONTROL_E2E_CONCURRENCY);
  } else if (
    (command !== 'update' && command !== 'record' && command !== 'merge') ||
    !output ||
    !inputPaths.length
  ) {
    console.error(
      'Usage: bun e2e-groups.ts update <durations.json> <log> [log...]\n' +
        '       bun e2e-groups.ts record <group.json> <log> [log...]\n' +
        '       bun e2e-groups.ts merge <durations.json> <group.json> [...]\n' +
        '       bun e2e-groups.ts concurrency'
    );
    process.exit(1);
  } else if (command === 'update') {
    await writeE2EDurations(output, parseE2EDurations(readLogs()));
  } else if (command === 'record') {
    let measurement: E2EGroupMeasurement = {
      durations: parseE2EDurations(readLogs()),
      shards: parseE2EGroupShards(process.env.E2E_TEST_ARGS ?? '')
    };

    await Bun.write(output, `${JSON.stringify(measurement, null, 2)}\n`);
    console.log(
      `Recorded ${Object.keys(measurement.durations).length} package duration(s) in ${output}`
    );
  } else {
    let { durations, incomplete } = mergeE2EGroupMeasurements(
      inputPaths.map(readE2EGroupMeasurement)
    );
    if (incomplete.length)
      console.warn(`Skipping packages with missing shards: ${incomplete.join(', ')}`);

    await writeE2EDurations(output, durations);
  }
}
