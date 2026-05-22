import { SQL, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  bigint,
  customType,
  index,
  jsonb,
  pgTable,
  serial,
  text,
  unique
} from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import { env } from '../../env';

export let tsvector = customType<{ data: string }>({
  dataType: () => `tsvector`
});

export let records = pgTable(
  'records',
  {
    id: serial('id').primaryKey(),
    indexId: bigint('index_id', { mode: 'bigint' }).notNull(),
    documentId: text('document_id').notNull(),
    tenantOids: bigint('tenant_oids', { mode: 'bigint' }).array(),
    fields: jsonb('fields').notNull(),
    body: text('body').notNull(),
    bodySearch: tsvector('body_search')
      .notNull()
      .generatedAlwaysAs((): SQL => sql`to_tsvector('english', body)`)
  },
  t => [
    index('idx_body_search').using('gin', t.bodySearch),
    index('idx_fields').using('gin', t.fields),
    index('idx_tenant_oids').using('gin', t.tenantOids),
    unique('idx_document_id').on(t.documentId)
  ]
);

export let db = env.service.SEARCH_DATABASE_URL
  ? drizzle(env.service.SEARCH_DATABASE_URL, {
      schema: { records }
    })
  : null;

if (db && env.service.SEARCH_DATABASE_URL) {
  let dbUrl = new URL(env.service.SEARCH_DATABASE_URL);
  let dbName = dbUrl.pathname.slice(1);

  let defaultPool = new Pool({
    connectionString: env.service.SEARCH_DATABASE_URL.replace(`/${dbName}`, '/postgres')
  });
  let client = await defaultPool.connect();

  try {
    let res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created.`);
    }
  } finally {
    client.release();
    await defaultPool.end();
  }

  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS records (
      id serial PRIMARY KEY,
      index_id bigint NOT NULL,
      document_id text NOT NULL,
      tenant_oids bigint[] NULL,
      fields jsonb NOT NULL,
      body text NOT NULL,
      body_search tsvector GENERATED ALWAYS AS (to_tsvector('english', body)) STORED
    );
  `);

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_body_search ON records USING gin (body_search);`
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_body_trgm ON records USING gin (body gin_trgm_ops);`
  );
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_body_title_trgm
    ON records USING gin ((btrim(split_part(body, ',', 1))) gin_trgm_ops);
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_fields ON records USING gin (fields);`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_tenant_oids ON records USING gin (tenant_oids);`
  );
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_document_id ON records (document_id);`
  );

  console.log(`Database "${dbName}" initialized.`);
}
