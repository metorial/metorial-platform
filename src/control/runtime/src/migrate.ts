import { join } from 'node:path';
import { Client } from 'pg';
import type { DatabaseConfig, RuntimeConfig } from './config';
import { signWithIam } from './iam';
import { describeSources, redactUrl, resolveDatabaseUrl } from './url';

type Env = Record<string, string | undefined>;

export let resolveWithIam = async (db: DatabaseConfig, env: Env) => {
  let url = resolveDatabaseUrl(db, env);
  if (!url) {
    throw new Error(`No database url configured for ${db.name} (set ${describeSources(db)})`);
  }

  return db.iam ? signWithIam(url, db.iam, env) : url;
};

let push = async (db: DatabaseConfig, url: string, root: string) => {
  let process_ = Bun.spawn(
    [
      ...(process.env.PRISMA_BIN
        ? [process.env.PRISMA_BIN]
        : [process.execPath, 'run', 'prisma']),
      'db',
      'push',
      '--schema',
      db.schema,
      '--accept-data-loss',
      '--url',
      url
    ],
    { cwd: root, stdout: 'inherit', stderr: 'inherit', env: process.env }
  );

  let code = await process_.exited;
  if (code !== 0) throw new Error(`prisma db push failed for ${db.name} (exit code ${code})`);
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

let withLock = async <T>(
  db: DatabaseConfig,
  url: string,
  run: (client: Client) => Promise<T>
) => {
  let lockUrl = new URL(url);
  let mode = lockUrl.searchParams.get('sslmode');
  lockUrl.searchParams.delete('sslmode');

  let client = new Client({
    connectionString: lockUrl.toString(),
    ssl: mode === 'require' || mode === 'no-verify' ? { rejectUnauthorized: false } : undefined
  });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1::bigint)', [db.lock]);

    return await run(client);
  } finally {
    await client.end();
  }
};

export let migrateDatabase = async (db: DatabaseConfig, env: Env, root: string) => {
  let url = await resolveWithIam(db, env);
  console.log(`Migrating ${db.name} using ${redactUrl(url)}`);

  if (db.lock === undefined) {
    await push(db, url, root);

    return;
  }

  await withLock(db, url, async client => {
    if (db.renames?.length) await renameColumns(client, db.renames);
    await push(db, url, root);
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

  for (let db of config.databases) {
    if (names.length && !names.includes(db.name)) continue;

    await migrateDatabase(db, env, root);
  }
};

export let defaultRoot = () => process.env.CONTROL_APP_ROOT ?? process.cwd();
export let defaultConfigPath = (root: string) => join(root, '.control', 'runtime.json');
