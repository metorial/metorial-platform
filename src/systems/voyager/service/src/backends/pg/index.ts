import {
  and,
  arrayOverlaps,
  eq,
  inArray,
  isNull,
  or,
  sql,
  type SQL
} from 'drizzle-orm';
import type { Record as DbRecord, Index } from '../../../prisma/generated/client';
import { Backend, type SearchParams } from '../_backend';
import { db, records } from './schema';
import { normalizeSearchQuery } from '../../utils/searchQuery';

const SUBSPACE_PROVIDER_LISTING_INDEX_IDENTIFIER = 'subspace_provider_listing';

export class PgBackend extends Backend {
  override isEnabled(): boolean {
    return !!db;
  }

  async indexRecords(index: Index, recordsToInsert: DbRecord[]) {
    if (!db) throw new Error('Database not initialized');

    if (recordsToInsert.length === 0) return;

    for (let r of recordsToInsert) {
      let inner = {
        tenantOids: r.isTenantSpecific ? r.tenantOids : null,
        fields: r.fields,
        body:
          typeof r.body == 'string'
            ? r.body
            : Object.values(r.body as any)
                .filter(Boolean)
                .join(', ')
      };

      await db
        .insert(records)
        .values({
          indexId: index.oid,
          documentId: r.documentId,
          ...inner
        })
        .onConflictDoUpdate({
          target: records.documentId,
          set: inner
        });
    }
  }

  async deleteRecordsById(index: Index, recordIds: string[]) {
    if (!db) throw new Error('Database not initialized');

    if (recordIds.length === 0) return;

    await db
      .delete(records)
      .where(and(eq(records.indexId, index.oid), inArray(records.documentId, recordIds)));
  }

  private buildBaseWheres(index: Index, filters?: { [key: string]: any }, tenantOids?: bigint[]) {
    let wheres: SQL[] = [eq(records.indexId, index.oid)];

    if (filters && Object.keys(filters).length > 0) {
      for (let [key, value] of Object.entries(filters)) {
        wheres.push(sql`fields @> ${JSON.stringify({ [key]: value })}::jsonb`);
      }
    }

    if (tenantOids?.length) {
      let tenantWhere = or(
        isNull(records.tenantOids),
        arrayOverlaps(records.tenantOids, tenantOids)
      );

      if (tenantWhere) {
        wheres.push(tenantWhere);
      }
    } else {
      wheres.push(isNull(records.tenantOids));
    }

    return wheres;
  }

  private async searchRecordsByTitle(
    index: Index,
    normalizedQuery: string,
    filters?: { [key: string]: any },
    tenantOids?: bigint[]
  ) {
    if (!db) throw new Error('Database not initialized');

    let titleExpression = sql`btrim(split_part(${records.body}, ',', 1))`;

    return await db
      .select({ documentId: records.documentId })
      .from(records)
      .where(
        and(
          ...this.buildBaseWheres(index, filters, tenantOids),
          sql`${titleExpression} ILIKE '%' || ${normalizedQuery} || '%'`
        )
      )
      .orderBy(
        sql`position(lower(${normalizedQuery}) in lower(${titleExpression}))`,
        sql`char_length(${titleExpression})`,
        records.documentId
      )
      .limit(100);
  }

  private async searchRecordsByBody(
    index: Index,
    normalizedQuery: string,
    filters?: { [key: string]: any },
    tenantOids?: bigint[]
  ) {
    if (!db) throw new Error('Database not initialized');

    let wheres = this.buildBaseWheres(index, filters, tenantOids);

    if (normalizedQuery) {
      wheres.push(sql`
        (
          body_search @@ plainto_tsquery('english', ${normalizedQuery})
          OR (
            char_length(${normalizedQuery}) >= 3
            AND ${normalizedQuery} <% body
          )
        )
      `);
    }

    return await db
      .select({ documentId: records.documentId })
      .from(records)
      .where(and(...wheres))
      .limit(100);
  }

  async searchRecords(index: Index, { query, filters, tenantOids }: SearchParams) {
    if (!db) throw new Error('Database not initialized');

    let normalizedQuery = query ? normalizeSearchQuery(query) : '';

    if (
      normalizedQuery &&
      index.identifier === SUBSPACE_PROVIDER_LISTING_INDEX_IDENTIFIER
    ) {
      let titleMatches = await this.searchRecordsByTitle(
        index,
        normalizedQuery,
        filters,
        tenantOids
      );

      if (titleMatches.length > 0) {
        return { records: titleMatches };
      }
    }

    return {
      records: await this.searchRecordsByBody(index, normalizedQuery, filters, tenantOids)
    };
  }
}
