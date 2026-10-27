import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export let sortedEntries = <T>(value: Record<string, T>): [string, T][] =>
  Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

export let readJson = <T = Record<string, unknown>>(path: string): T => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (error) {
    throw new Error(`invalid ${path}`, { cause: error });
  }
};

export let writeJson = (path: string, value: unknown) =>
  atomicWrite(path, JSON.stringify(value, null, 2) + '\n');

export let atomicWrite = (path: string, contents: string) => {
  mkdirSync(dirname(path), { recursive: true });

  let temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, contents);
  renameSync(temporary, path);
};

export let canonical = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

export let within = (root: string, path: string) => {
  let part = relative(root, path);

  return part === '' || (!part.startsWith('..' + '/') && part !== '..' && !isAbsolute(part));
};

export let ancestors = function* (start: string): Generator<string> {
  let path = resolve(start);

  while (true) {
    yield path;

    let parent = dirname(path);
    if (parent === path) return;
    path = parent;
  }
};

export let walk = (root: string, filename: string): string[] => {
  let result: string[] = [];
  let visit = (directory: string, depth: number) => {
    let entries;

    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (let entry of entries) {
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        if (['.git', '.control', 'node_modules', 'target'].includes(entry.name)) continue;

        if (depth === 0 && entry.name === 'out') continue;
        visit(join(directory, entry.name), depth + 1);
      } else if (entry.isFile() && entry.name === filename) {
        result.push(join(directory, entry.name));
      }
    }
  };

  visit(root, 0);

  return result.sort(comparePaths);
};

export let packageName = (directory: string): string | undefined => {
  if (!existsSync(join(directory, 'package.json'))) return;

  try {
    let value = readJson(join(directory, 'package.json')).name;

    return typeof value === 'string' ? value : undefined;
  } catch {
    return;
  }
};

export let packageScripts = (directory: string): Record<string, string> => {
  let value = readJson<{ scripts?: Record<string, unknown> }>(join(directory, 'package.json'));

  return Object.fromEntries(
    sortedEntries(value.scripts ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
};

export let comparePaths = (left: string, right: string) => {
  let a = left.split(sep).filter(Boolean);
  let b = right.split(sep).filter(Boolean);

  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index] !== b[index]) return a[index]! < b[index]! ? -1 : 1;
  }

  return a.length - b.length;
};

export let sortJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortJson);

  if (value && typeof value === 'object')
    return Object.fromEntries(
      sortedEntries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sortJson(item)
      ])
    );

  return value;
};
