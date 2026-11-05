import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { generatedOutputs, installedVersion, pool, schemaFiles } from '../src/database';
import { walk } from '../src/files';
import { temporary } from './helpers';

let write = (path: string, contents = '') => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents);
};

test('pool runs every item with bounded concurrency and aggregates failures', async () => {
  let active = 0;
  let peak = 0;
  let seen: number[] = [];

  let error = (await pool([1, 2, 3, 4, 5, 6], 2, async item => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    seen.push(item);
    if (item % 3 === 0) throw new Error(`failed ${item}`);
  }).catch(caught => caught)) as Error;

  expect(peak).toBe(2);
  expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6]);
  expect(error.message).toContain('failed 3');
  expect(error.message).toContain('failed 6');
});

test('schemaFiles ignores generated output, migrations and dependencies', () => {
  let root = temporary();
  write(join(root, 'prisma/schema/a.prisma'));
  write(join(root, 'prisma/schema.prisma'));
  write(join(root, 'prisma/generated/client/schema.prisma'));
  write(join(root, 'prisma/migrations/1/schema.prisma'));
  write(join(root, 'prisma/readme.md'));

  expect(schemaFiles(root).map(path => path.slice(root.length + 1))).toEqual([
    'prisma/schema/a.prisma',
    'prisma/schema.prisma'
  ]);
});

test('generatedOutputs resolves generator output paths relative to the schema', () => {
  let root = temporary();
  let file = join(root, 'prisma/schema.prisma');
  write(
    file,
    'datasource db {\n  provider = "postgresql"\n}\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../src/generated"\n}\n'
  );

  expect(generatedOutputs([file])).toEqual([join(root, 'src/generated')]);
});

test('installedVersion walks up to the nearest node_modules', () => {
  let root = temporary();
  write(join(root, 'node_modules/prisma/package.json'), '{"version":"7.1.0"}');
  mkdirSync(join(root, 'a/b'), { recursive: true });

  expect(installedVersion(join(root, 'a/b'), 'prisma')).toBe('7.1.0');
  expect(installedVersion(join(root, 'a/b'), 'missing')).toBe('');
});

test('git-backed walk skips ignored directories but matches a full walk otherwise', () => {
  let root = temporary();
  write(join(root, '.gitignore'), 'junk\n');
  write(join(root, 'a/package.json'), '{}');
  write(join(root, 'junk/deep/package.json'), '{}');
  write(join(root, 'b/package.json'), '{}');

  let git = (...args: string[]) => spawnSync('git', ['-C', root, ...args]);
  git('init', '-q');
  git('add', 'a');

  let relative = (paths: string[]) => paths.map(path => path.slice(root.length + 1));

  expect(relative(walk(root, 'package.json'))).toEqual(['a/package.json', 'b/package.json']);

  process.env.CONTROL_FULL_WALK = '1';
  try {
    expect(relative(walk(root, 'package.json'))).toEqual([
      'a/package.json',
      'b/package.json',
      'junk/deep/package.json'
    ]);
  } finally {
    delete process.env.CONTROL_FULL_WALK;
  }
});

test('git-backed walk descends into submodule checkouts', () => {
  let root = temporary();
  let sub = join(root, 'oss');
  mkdirSync(sub, { recursive: true });
  let git = (cwd: string, ...args: string[]) =>
    spawnSync('git', ['-C', cwd, '-c', 'user.email=a@b.c', '-c', 'user.name=t', ...args]);

  git(sub, 'init', '-q');
  write(join(sub, 'x/package.json'), '{}');
  git(sub, 'add', '.');
  git(sub, 'commit', '-q', '-m', 'x');

  git(root, 'init', '-q');
  write(join(root, 'y/package.json'), '{}');
  git(root, 'add', 'y');
  git(root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', sub, 'oss-copy');

  let found = walk(root, 'package.json').map(path => path.slice(root.length + 1));

  expect(found).toContain('y/package.json');
  expect(found).toContain('oss-copy/x/package.json');
  expect(readFileSync(join(root, 'y/package.json'), 'utf8')).toBe('{}');
});
