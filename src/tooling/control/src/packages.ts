import { dirname, resolve, relative } from 'node:path';
import { readJson, walk, within } from './files';

export let discoverPackages = (root: string) => {
  let names = new Set<string>();

  return walk(root, 'package.json')
    .filter(
      path =>
        !relative(root, path)
          .split('/')
          .some(part => part === '.turbo' || part === 'dist')
    )
    .flatMap(path => {
      let value: { name?: string; scripts?: Record<string, unknown> };

      try {
        value = readJson(path);
      } catch {
        return [];
      }

      if (!value.name || typeof value.name !== 'string' || names.has(value.name)) return [];
      names.add(value.name);

      return [
        {
          name: value.name,
          directory: dirname(path),
          scripts: new Set(
            Object.entries(value.scripts ?? {})
              .filter(([, command]) => typeof command === 'string')
              .map(([script]) => script)
          )
        }
      ];
    });
};

export let wildcard = (pattern: string, value: string) =>
  new RegExp(
    '^' +
      pattern
        .split('*')
        .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$',
    'u'
  ).test(value);

export let globMatch = (pattern: string, path: string): boolean => {
  let patterns = resolve(pattern).split('/');
  let parts = resolve(path).split('/');
  let memo = new Map<string, boolean>();
  let match = (p: number, v: number): boolean => {
    let key = `${p}:${v}`;
    if (memo.has(key)) return memo.get(key)!;

    let result =
      p === patterns.length
        ? v === parts.length
        : patterns[p] === '**'
          ? match(p + 1, v) || (v < parts.length && match(p, v + 1))
          : v < parts.length && wildcard(patterns[p]!, parts[v]!) && match(p + 1, v + 1);
    memo.set(key, result);

    return result;
  };

  return match(0, 0);
};

export let relativePath = (root: string, path: string) =>
  within(root, path) ? relative(root, path) || '.' : path;
