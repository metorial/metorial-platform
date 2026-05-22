import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { EntrypointError, ResolveTargetError } from './errors';

export let resolveControlCwd = (): string => {
  if (process.env.METORIAL_PWD) return resolve(process.env.METORIAL_PWD);
  return process.cwd();
};

export let findControlRoot = (start: string): string => {
  let dir = resolve(start);
  let repoRoots: string[] = [];

  while (true) {
    if (existsSync(join(dir, '.git'))) {
      repoRoots.push(dir);
    }
    let parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (repoRoots.length > 0) return repoRoots[repoRoots.length - 1]!;
  return resolve(start);
};

export let findOssRoot = (start: string): string | null => {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, 'src/systems')) && existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    let parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

export let resolveEntrypoint = (opts: { cwd: string; entrypoint?: string }): string => {
  if (opts.entrypoint) {
    let ep = resolve(opts.cwd, opts.entrypoint);
    if (!existsSync(ep)) {
      throw new EntrypointError(`Entrypoint not found: ${ep}`, [`Resolved from: ${opts.cwd}`]);
    }

    try {
      resolveOssRoot(ep);
      return ep;
    } catch {
      return findControlRoot(ep);
    }
  }

  return findControlRoot(opts.cwd);
};

export let resolveOssRoot = (entrypoint: string): string => {
  let ossAt = join(entrypoint, 'oss');
  if (existsSync(join(ossAt, 'src/systems'))) return ossAt;
  if (existsSync(join(entrypoint, 'src/systems'))) return entrypoint;
  throw new EntrypointError(`Could not resolve OSS root from entrypoint ${entrypoint}`, [
    `Expected oss/src/systems or src/systems under ${entrypoint}`
  ]);
};

export let resolveControlDir = (entrypoint: string, target: string): string => {
  let candidates = [
    resolve(entrypoint, target),
    resolve(resolveOssRoot(entrypoint), target.replace(/^oss\//, '')),
    resolve(entrypoint, 'oss', target.replace(/^oss\//, ''))
  ];

  for (let candidate of candidates) {
    if (existsSync(join(candidate, 'control.toml'))) return candidate;
  }

  throw new ResolveTargetError({ target, candidates });
};

export let controlToolingDir = import.meta.dir.replace(/\/src$/, '');
