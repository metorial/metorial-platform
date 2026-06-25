import { algoliasearch, type Algoliasearch } from 'algoliasearch';
import type { Record as DbRecord, Index } from '../../../prisma/generated/client';
import { env } from '../../env';
import { Backend, type SearchParams } from '../_backend';

export class AlgoliaBackend extends Backend {
  private client?: Algoliasearch;
  private prefix: string;

  constructor() {
    super();
    this.client =
      env.service.ALGOLIA_APP_ID && env.service.ALGOLIA_API_KEY
        ? algoliasearch(env.service.ALGOLIA_APP_ID, env.service.ALGOLIA_API_KEY)
        : undefined;
    this.prefix = env.service.ALGOLIA_INDEX_PREFIX ?? '';
  }

  override isEnabled(): boolean {
    return !!env.service.ALGOLIA_APP_ID && !!env.service.ALGOLIA_API_KEY;
  }

  private indexName(index: Index): string {
    return `${this.prefix}${index.identifier}`;
  }

  async indexRecords(index: Index, records: DbRecord[]) {
    if (records.length === 0) return;

    let objects = records.map(r => ({
      objectID: r.documentId,
      fields: r.fields,
      body:
        typeof r.body === 'string'
          ? r.body
          : Object.values(r.body as any)
              .filter(Boolean)
              .join(', '),
      tenantOids: r.isTenantSpecific ? r.tenantOids.map(String) : null
    }));

    await this.client!.saveObjects({
      indexName: this.indexName(index),
      objects
    });
  }

  async deleteRecordsById(index: Index, recordIds: string[]) {
    if (recordIds.length === 0) return;

    await this.client!.deleteObjects({
      indexName: this.indexName(index),
      objectIDs: recordIds
    });
  }

  async searchRecords(index: Index, { query, filters, tenantOids }: SearchParams) {
    let facetFilters: string[] = [];

    if (filters && Object.keys(filters).length > 0) {
      for (let [key, value] of Object.entries(filters)) {
        facetFilters.push(`fields.${key}:${value}`);
      }
    }

    if (tenantOids?.length) {
      facetFilters.push(tenantOids.map(oid => `tenantOids:${String(oid)}`).join(' OR '));
    }

    let filterString = facetFilters.join(' AND ');

    let result = await this.client!.searchSingleIndex({
      indexName: this.indexName(index),
      searchParams: {
        query: query || '',
        filters: filterString || undefined,
        hitsPerPage: 100
      }
    });

    return {
      records: result.hits.map(h => ({ documentId: h.objectID }))
    };
  }
}
