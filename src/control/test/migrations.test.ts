import { beforeAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  checkTarget,
  createMigration,
  currentSchema,
  migrationSlug,
  snapshotPath,
  writeSnapshot,
  type MigrationTarget
} from '../src/migrations';
import { temporary } from './helpers';

let userModel = `model User {
  id   Int    @id
  name String
}
`;

let datasource = `datasource db {
  provider = "postgresql"
}
`;

let write = (path: string, contents: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

let git = (directory: string, ...args: string[]) => {
  let result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
};

let target = (): MigrationTarget => {
  let directory = temporary();

  write(join(directory, 'prisma', 'schema', 'base.prisma'), datasource);
  write(join(directory, 'prisma', 'schema', 'user', 'user.prisma'), userModel);

  return {
    name: 'main',
    package: '@test/main',
    directory,
    schema: join(directory, 'prisma', 'schema'),
    migrations: join(directory, 'prisma', 'migrations'),
    owners: [directory]
  };
};

let initialize = (item: MigrationTarget) => {
  write(
    join(item.migrations, '0_init', 'migration.sql'),
    'CREATE TABLE "User" (id INT PRIMARY KEY, name TEXT NOT NULL);\n'
  );
  writeSnapshot(item);
};

beforeAll(() => {
  let binary = resolve(import.meta.dir, '../../../../node_modules/.bin/prisma');

  if (!process.env.PRISMA_BIN && existsSync(binary)) process.env.PRISMA_BIN = binary;
});

test('migrationSlug normalizes separators and rejects unsafe names', () => {
  expect(migrationSlug('Add Users-Table')).toBe('add_users_table');
  expect(() => migrationSlug('../escape')).toThrow('invalid migration name');
  expect(() => migrationSlug('1abc')).toThrow('invalid migration name');
});

test('currentSchema concatenates nested schema files in a stable order', () => {
  let item = target();

  expect(currentSchema(item)).toBe(`${datasource}\n${userModel}`);

  write(join(item.schema, 'generated', 'ignored.prisma'), 'model Ignored { id Int @id }');
  write(join(item.schema, 'migrations', 'ignored.prisma'), 'model Ignored { id Int @id }');

  expect(currentSchema(item)).not.toContain('Ignored');
});

test('check reports a target without migrations', () => {
  let problems = checkTarget(target());

  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain('has no migrations');
});

test('check reports a missing snapshot and an incomplete migration', () => {
  let item = target();

  mkdirSync(join(item.migrations, '0_init'), { recursive: true });

  let problems = checkTarget(item);

  expect(problems.some(problem => problem.includes('has no migration.sql'))).toBe(true);
  expect(problems.some(problem => problem.includes('schema.snapshot.prisma is missing'))).toBe(
    true
  );
});

test('check passes when the schema matches the snapshot', () => {
  let item = target();

  initialize(item);

  expect(checkTarget(item)).toEqual([]);
});

test('check fails when the schema changed and create then fixes it', () => {
  let item = target();

  initialize(item);
  write(
    join(item.schema, 'user', 'user.prisma'),
    userModel.replace('name String', 'name String\n  age  Int?')
  );

  let problems = checkTarget(item);

  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain('control db migration create main <name>');

  let created = createMigration(item, 'add age', new Date('2026-11-09T16:30:15Z'));

  expect(created.folder).toBe('20261109163015_add_age');
  expect(
    readFileSync(join(item.migrations, created.folder, 'migration.sql'), 'utf8')
  ).toContain('ADD COLUMN     "age" INTEGER');
  expect(readFileSync(snapshotPath(item), 'utf8')).toContain('age  Int?');
  expect(checkTarget(item)).toEqual([]);
});

test('create refuses when nothing changed', () => {
  let item = target();

  initialize(item);

  expect(() => createMigration(item, 'noop')).toThrow('no changes since the last migration');
});

test('history check rejects edits to applied migrations and snapshot-only changes', () => {
  let item = target();

  initialize(item);
  write(join(item.migrations, '1_extra', 'migration.sql'), 'SELECT 1;\n');
  git(item.directory, 'init', '-q', '-b', 'main');
  git(item.directory, 'config', 'user.email', 'test@example.com');
  git(item.directory, 'config', 'user.name', 'Test');
  git(item.directory, 'add', '-A');
  git(item.directory, 'commit', '-q', '-m', 'base');
  git(item.directory, 'checkout', '-q', '-b', 'feature');

  expect(checkTarget(item, 'main')).toEqual([]);

  write(join(item.migrations, '0_init', 'migration.sql'), 'SELECT 1;\n');

  let edited = checkTarget(item, 'main');

  expect(edited.some(problem => problem.includes('0_init/migration.sql was modified'))).toBe(
    true
  );

  git(item.directory, 'checkout', '-q', '--', '.');
  rmSync(join(item.migrations, '1_extra'), { recursive: true });

  expect(
    checkTarget(item, 'main').some(problem =>
      problem.includes('1_extra/migration.sql was deleted')
    )
  ).toBe(true);

  git(item.directory, 'checkout', '-q', '--', '.');
  write(join(item.schema, 'user', 'user.prisma'), `${userModel}\n// changed\n`);
  writeSnapshot(item);

  expect(
    checkTarget(item, 'main').some(problem =>
      problem.includes('changed without a new migration being added')
    )
  ).toBe(true);
});

test('history check skips a base ref that does not exist', () => {
  let item = target();

  initialize(item);
  git(item.directory, 'init', '-q', '-b', 'main');

  expect(checkTarget(item, 'origin/missing')).toEqual([]);
});
