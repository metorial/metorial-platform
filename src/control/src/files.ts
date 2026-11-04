import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

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

let skippedDirectories = ['.git', '.control', 'node_modules', 'target'];

let git = (cwd: string, args: string[]) => {
  let result = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024
  });

  return result.status === 0 ? result.stdout : undefined;
};

// Untracked, gitignored directories (probe runs, object-storage data) can hold hundreds of
// thousands of entries, so tracked and not-ignored files are listed through git instead.
let gitFiles = (root: string): string[] | undefined => {
  if (process.env.CONTROL_FULL_WALK) return;

  let top = git(root, ['rev-parse', '--show-toplevel'])?.trim();
  if (!top || canonical(top) !== canonical(root)) return;

  let collect = (directory: string): string[] | undefined => {
    let listed = git(directory, [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard'
    ]);
    let staged = git(directory, ['ls-files', '-z', '--stage']);
    if (listed === undefined || staged === undefined) return;

    let files = listed
      .split('\0')
      .filter(Boolean)
      .map(path => join(directory, path));

    for (let entry of staged.split('\0')) {
      if (!entry.startsWith('160000 ')) continue;

      let path = join(directory, entry.slice(entry.indexOf('\t') + 1));
      if (!existsSync(join(path, '.git'))) continue;

      let nested = collect(path);
      if (!nested) return;
      files.push(...nested);
    }

    return files;
  };

  return collect(root);
};

let fileSystemFiles = (root: string): string[] => {
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
        if (skippedDirectories.includes(entry.name)) continue;

        if (depth === 0 && entry.name === 'out') continue;
        visit(join(directory, entry.name), depth + 1);
      } else if (entry.isFile()) {
        result.push(join(directory, entry.name));
      }
    }
  };

  visit(root, 0);

  return result;
};

let walkFiles = (
  root: string,
  accept: (directory: string, name: string) => boolean
): string[] => {
  let files = gitFiles(root);

  if (!files) files = fileSystemFiles(root);

  return files
    .filter(path => {
      let parts = relative(root, path).split(sep);

      return (
        !parts.slice(0, -1).some(part => skippedDirectories.includes(part)) &&
        !(parts.length > 1 && parts[0] === 'out') &&
        accept(dirname(path), basename(path))
      );
    })
    .filter(path => {
      try {
        let stat = lstatSync(path);

        return stat.isFile() && !stat.isSymbolicLink();
      } catch {
        return false;
      }
    })
    .sort(comparePaths);
};

export let walk = (root: string, filename: string): string[] =>
  walkFiles(root, (_directory, name) => name === filename);

export let walkManifests = (root: string): string[] =>
  walkFiles(
    root,
    (directory, name) =>
      name === 'index.ts' &&
      basename(directory) === 'control' &&
      existsSync(join(dirname(directory), 'package.json'))
  );

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
