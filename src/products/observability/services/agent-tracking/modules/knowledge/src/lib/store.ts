import { withTransaction } from '@mtsrc/agent-tracking-db';
import { vendorModelKey, emptyStoredState, type KnowledgeRow, type StoredState } from './rows';
import { tableSpecs, type ColumnType, type TableSpec } from './tables';

let upsertChunkSize = 1000;

let sqlTypes: Record<ColumnType, string> = {
  text: 'text',
  'text[]': 'text[]',
  boolean: 'boolean',
  integer: 'integer',
  date: 'date'
};

let quote = (name: string) => `"${name}"`;

type StoredQueryRow = {
  oid: bigint;
  id: string;
  contentHash: string;
  removed: boolean;
  pricingHash?: string | null;
  vendorId?: string | null;
  modelId?: string | null;
  firstSeenAt?: string | null;
  reportedFirstSeenAt?: string | null;
  priced?: boolean;
  historyFrom?: string | null;
};

let firstSeenColumns = `data->>'firstSeenAt' AS "firstSeenAt", data->>'reportedFirstSeenAt' AS "reportedFirstSeenAt"`;

let storedExtras: Partial<Record<TableSpec['entity'], string>> = {
  offering: `, "pricingHash", "vendorId", "modelId", ${firstSeenColumns},
    jsonb_typeof(data->'pricing') = 'object' AS priced`,
  name: `, ${firstSeenColumns},
    (SELECT min(period->>'from') FROM jsonb_array_elements(data->'history') period) AS "historyFrom"`
};

export let loadStoredState = async (): Promise<StoredState> =>
  withTransaction(
    async db => {
      let state = emptyStoredState();

      for (let spec of tableSpecs) {
        let rows = await db.$queryRawUnsafe<StoredQueryRow[]>(
          `SELECT oid, id, "contentHash", "removedAt" IS NOT NULL AS removed${storedExtras[spec.entity] ?? ''}
           FROM ${quote(spec.table)}`
        );

        let target = state[spec.entity];

        for (let row of rows) {
          target.set(row.id, {
            oid: row.oid,
            contentHash: row.contentHash,
            removed: row.removed,
            ...(spec.entity == 'offering'
              ? {
                  pricingHash: row.pricingHash ?? null,
                  vendorModelKey: vendorModelKey(row.vendorId, row.modelId),
                  priced: !!row.priced,
                  firstSeenAt: row.firstSeenAt ?? null,
                  reportedFirstSeenAt: row.reportedFirstSeenAt ?? null
                }
              : {}),
            ...(spec.entity == 'name'
              ? {
                  firstSeenAt: row.firstSeenAt ?? null,
                  reportedFirstSeenAt: row.reportedFirstSeenAt ?? null,
                  historyFrom: row.historyFrom ?? null
                }
              : {})
          });
        }
      }

      return state;
    },
    { ifExists: true }
  );

let upsertSql = (spec: TableSpec) => {
  let columns = spec.columns.map(column => quote(column.name));
  let definitions = spec.columns.map(
    column => `${quote(column.name)} ${sqlTypes[column.type]}`
  );
  let updates = [...columns, 'data', '"contentHash"'].map(
    column => `${column} = EXCLUDED.${column}`
  );

  return `
    INSERT INTO ${quote(spec.table)} (oid, id, ${columns.join(', ')}, data, "contentHash", "removedAt", "createdAt", "updatedAt")
    SELECT r.oid::bigint, r.id, ${columns.map(column => `r.${column}`).join(', ')}, r.data, r."contentHash", NULL, now(), now()
    FROM jsonb_to_recordset($1::jsonb) AS r(oid text, id text, ${definitions.join(', ')}, data jsonb, "contentHash" text)
    ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}, "removedAt" = NULL, "updatedAt" = now()`;
};

// Existing rows keep their oid (the conflict update never touches it), so price periods and
// anything else referencing an offering stay attached across publishes.
export let upsertRows = async (d: {
  spec: TableSpec;
  rows: KnowledgeRow[];
  oids: Map<string, bigint>;
}) =>
  withTransaction(async db => {
    let sql = upsertSql(d.spec);

    for (let start = 0; start < d.rows.length; start += upsertChunkSize) {
      let chunk = d.rows.slice(start, start + upsertChunkSize).map(row => ({
        oid: d.oids.get(row.id)!.toString(),
        id: row.id,
        ...row.columns,
        data: row.data,
        contentHash: row.contentHash
      }));

      await db.$executeRawUnsafe(sql, JSON.stringify(chunk));
    }
  });

export let markRemoved = async (d: { spec: TableSpec; ids: string[]; at: Date }) =>
  withTransaction(async db => {
    if (!d.ids.length) return;

    await db.$executeRawUnsafe(
      `UPDATE ${quote(d.spec.table)} SET "removedAt" = $2, "updatedAt" = now()
       WHERE id = ANY($1::text[]) AND "removedAt" IS NULL`,
      d.ids,
      d.at
    );
  });

export let loadStoredData = async (d: { spec: TableSpec; ids: string[] }) =>
  withTransaction(
    async db => {
      if (!d.ids.length) return new Map<string, unknown>();

      let rows = await db.$queryRawUnsafe<{ id: string; data: unknown }[]>(
        `SELECT id, data FROM ${quote(d.spec.table)} WHERE id = ANY($1::text[])`,
        d.ids
      );

      return new Map(rows.map(row => [row.id, row.data]));
    },
    { ifExists: true }
  );
