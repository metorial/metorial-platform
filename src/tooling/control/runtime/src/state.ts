import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'pg';

export interface FailedMigration {
  name: string;
  crashed: boolean;
}

export type DatabaseState =
  | { kind: 'fresh' }
  | { kind: 'legacy' }
  | { kind: 'migrated'; applied: string[] }
  | { kind: 'failed'; migrations: FailedMigration[] };

let migrationsTable = '_prisma_migrations';

export let listMigrations = (directory: string) => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true })
    .filter(
      entry => entry.isDirectory() && existsSync(join(directory, entry.name, 'migration.sql'))
    )
    .map(entry => entry.name)
    .sort();
};

export let detectState = async (client: Client, schema: string): Promise<DatabaseState> => {
  let tables = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
    [schema]
  );
  let names = tables.rows.map(row => row.table_name);

  if (!names.includes(migrationsTable)) {
    return names.length ? { kind: 'legacy' } : { kind: 'fresh' };
  }

  let rows = await client.query<{
    migration_name: string;
    logs: string | null;
    finished_at: Date | null;
    rolled_back_at: Date | null;
  }>(
    `SELECT migration_name, logs, finished_at, rolled_back_at FROM "${schema}"."${migrationsTable}"`
  );

  let failed = rows.rows
    .filter(row => !row.finished_at && !row.rolled_back_at)
    .map(row => ({ name: row.migration_name, crashed: !row.logs }));
  if (failed.length) return { kind: 'failed', migrations: failed };

  return {
    kind: 'migrated',
    applied: rows.rows
      .filter(row => row.finished_at && !row.rolled_back_at)
      .map(row => row.migration_name)
  };
};
