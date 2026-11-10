import { dirname, join, resolve } from 'node:path';
import type { Client } from 'pg';
import type { DatabaseConfig, RuntimeConfig } from './config';
import { signWithIam } from './iam';
import { schemaOf, withLock } from './lock';
import { deploy, markApplied, push, type PrismaTarget } from './prisma';
import { throwIfInterrupted, deferSignals } from './signals';
import { detectState, listMigrations, type FailedMigration } from './state';
import { describeSources, redactUrl, resolveDatabaseUrl } from './url';

type Env = Record<string, string | undefined>;

export let resolveWithIam = async (db: DatabaseConfig, env: Env) => {
  let url = resolveDatabaseUrl(db, env);
  if (!url) {
    throw new Error(`No database url configured for ${db.name} (set ${describeSources(db)})`);
  }

  return db.iam ? signWithIam(url, db.iam, env) : url;
};

let renameColumns = async (
  client: Client,
  renames: NonNullable<DatabaseConfig['renames']>
) => {
  for (let { table, from, to } of renames) {
    await client.query(
      `DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2)
          AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $3)
        THEN
          EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', $1, $2, $3);
        END IF;
      END $$;`
        .replaceAll('$1', quote(table))
        .replaceAll('$2', quote(from))
        .replaceAll('$3', quote(to))
    );
  }
};

let quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

let describeFailures = (db: DatabaseConfig, failed: FailedMigration[]) =>
  [
    `Migration history of ${db.name} contains failed migrations, refusing to continue:`,
    ...failed.map(
      ({ name, crashed }) =>
        `  - ${name} (${crashed ? 'the process was interrupted while it ran' : 'the SQL failed, see _prisma_migrations.logs'})`
    ),
    'Part of a failed migration may be committed. Inspect the database, then fix it by hand and run `prisma migrate resolve --applied <name>` or `--rolled-back <name>`.'
  ].join('\n');

let baseline = async (
  db: DatabaseConfig,
  target: PrismaTarget,
  client: Client,
  names: string[]
) => {
  console.log(`${db.name} has tables but no migration history, baselining`);

  if (db.renames?.length) await renameColumns(client, db.renames);
  await push(target);

  for (let name of names) {
    await markApplied(target, name);
  }

  console.log(`${db.name} baselined with ${names.length} migration(s)`);
};

export let migrateDatabase = async (db: DatabaseConfig, env: Env, root: string) => {
  throwIfInterrupted();

  let url = await resolveWithIam(db, env);
  console.log(`Migrating ${db.name} using ${redactUrl(url)}`);

  let schema = resolve(root, db.schema);
  let target: PrismaTarget = {
    name: db.name,
    schema,
    migrations: join(dirname(schema), 'migrations'),
    url,
    root
  };
  let names = listMigrations(target.migrations);

  await withLock(db, url, async client => {
    if (!names.length) {
      if (db.renames?.length) await renameColumns(client, db.renames);
      await push(target);

      return;
    }

    let state = await detectState(client, schemaOf(url));

    if (state.kind === 'failed') throw new Error(describeFailures(db, state.migrations));
    if (state.kind === 'legacy') await baseline(db, target, client, names);

    await deploy(target);
  });
};

export let migrate = async (
  config: RuntimeConfig,
  names: string[],
  env: Env,
  root: string
) => {
  let unknown = names.filter(name => !config.databases.some(db => db.name === name));
  if (unknown.length) throw new Error(`Unknown database ${unknown.join(', ')}`);

  deferSignals();

  for (let db of config.databases) {
    if (names.length && !names.includes(db.name)) continue;

    await migrateDatabase(db, env, root);
  }

  throwIfInterrupted();
};

export let defaultRoot = () => process.env.CONTROL_APP_ROOT ?? process.cwd();
export let defaultConfigPath = (root: string) => join(root, '.control', 'runtime.json');
