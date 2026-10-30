import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
import type { Violation } from './verify';

export type EgressAllowEntry = {
  host: string;
  in?: string[];
  reason: string;
};

export type EgressPolicy = {
  denyHosts: string[];
  allow?: EgressAllowEntry[];
};

let scannedExtensions = ['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.svg'];

let listFiles = async (path: string): Promise<string[]> => {
  let results: string[] = [];

  for (let entry of await readdir(path, { withFileTypes: true })) {
    let child = join(path, entry.name);

    if (entry.isDirectory()) results.push(...(await listFiles(child)));
    else if (
      scannedExtensions.some(ext => entry.name.endsWith(ext)) &&
      !entry.name.endsWith('.map')
    ) {
      results.push(child);
    }
  }

  return results;
};

export let matchesHostPattern = (host: string, pattern: string) => {
  let normalized = host.toLowerCase();

  if (pattern == '*') return true;

  if (pattern.startsWith('*.')) {
    let suffix = pattern.slice(2).toLowerCase();
    return normalized == suffix || normalized.endsWith(`.${suffix}`);
  }

  return normalized == pattern.toLowerCase();
};

let escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let toHostRegex = (pattern: string) => {
  let suffix = escape(pattern.replace(/^\*\./, '').toLowerCase());
  let subdomains = pattern.startsWith('*.') ? '(?:[a-z0-9-]+\\.)*' : '';

  return new RegExp(`(?<![a-z0-9.-])(${subdomains}${suffix})(?![a-z0-9-])`, 'gi');
};

type HostMatch = { host: string; index: number };

export let findDeniedHosts = (content: string, denyHosts: string[]): HostMatch[] => {
  let matches: HostMatch[] = [];

  for (let pattern of denyHosts) {
    for (let match of content.matchAll(toHostRegex(pattern))) {
      matches.push({ host: match[1]!.toLowerCase(), index: match.index! });
    }
  }

  return matches;
};

let lineStarts = (content: string) => {
  let starts = [0];

  for (
    let index = content.indexOf('\n');
    index >= 0;
    index = content.indexOf('\n', index + 1)
  ) {
    starts.push(index + 1);
  }

  return starts;
};

let locate = (starts: number[], index: number) => {
  let low = 0;
  let high = starts.length - 1;

  while (low < high) {
    let middle = Math.ceil((low + high) / 2);
    if (starts[middle]! <= index) low = middle;
    else high = middle - 1;
  }

  return { line: low + 1, column: index - starts[low]! };
};

let isAllowed = (policy: EgressPolicy, host: string, source: string) =>
  !!policy.allow?.some(
    entry =>
      matchesHostPattern(host, entry.host) &&
      (!entry.in || entry.in.some(glob => new Bun.Glob(glob).match(source)))
  );

export let verifyEgress = async (
  paths: string[],
  policy: EgressPolicy,
  root = process.cwd()
): Promise<Violation[]> => {
  let violations: Violation[] = [];
  let reported = new Set<string>();

  for (let path of paths) {
    for (let file of await listFiles(resolve(path))) {
      let content = await readFile(file, 'utf8');
      let matches = findDeniedHosts(content, policy.denyHosts);
      if (!matches.length) continue;

      let mapPath = `${file}.map`;
      let map = existsSync(mapPath)
        ? new TraceMap(await readFile(mapPath, 'utf8'), pathToFileUrl(mapPath))
        : undefined;
      let starts = map ? lineStarts(content) : [];

      for (let { host, index } of matches) {
        let origin = file;

        if (map) {
          let position = locate(starts, index);
          let original = originalPositionFor(map, position);

          if (original.source) {
            let absolute = original.source.startsWith('file://')
              ? decodeURIComponent(new URL(original.source).pathname)
              : resolve(dirname(mapPath), original.source);

            origin = `${relative(root, absolute)}:${original.line ?? 0}`;
          }
        }

        let sourcePath = origin.replace(/:\d+$/, '');
        if (isAllowed(policy, host, sourcePath)) continue;

        let key = `${host}@${origin}`;
        if (reported.has(key)) continue;

        reported.add(key);
        violations.push({
          kind: 'egress',
          message: `${host} is denied by the egress policy but is referenced in ${origin}`
        });
      }
    }
  }

  return violations;
};

let pathToFileUrl = (path: string) => `file://${path}`;
