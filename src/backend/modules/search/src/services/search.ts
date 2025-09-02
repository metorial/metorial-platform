import { Service } from '@metorial/service';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import { Index, MeiliSearch, MeiliSearchApiError } from 'meilisearch';
import { env } from '../env';

export type SearchIndex = 'server_listing';

let meilisearchIndices = new Map<string, Index>();
let openSearchIndices = new Set<string>();

let meilisearchPrefix = env.meiliSearch.MEILISEARCH_INDEX_PREFIX;
let openSearchPrefix = env.openSearch.OPENSEARCH_INDEX_PREFIX;

export let meiliSearch = env.meiliSearch.MEILISEARCH_HOST
  ? new MeiliSearch({
      host: env.meiliSearch.MEILISEARCH_HOST,
      apiKey: env.meiliSearch.MEILISEARCH_API_KEY
    })
  : undefined;

export let openSearch = env.openSearch?.OPENSEARCH_HOST
  ? new OpenSearchClient({
      node: env.openSearch.OPENSEARCH_HOST,
      auth: {
        username: env.openSearch.OPENSEARCH_USERNAME!,
        password: env.openSearch.OPENSEARCH_PASSWORD!
      }
    })
  : undefined;

class SearchService {
  private async ensureIndex(index: SearchIndex) {
    if (meiliSearch && !meilisearchIndices.has(index)) {
      let indexName = meilisearchPrefix ? `${meilisearchPrefix}_${index}` : index;
      let meiliIndex = meiliSearch.index(indexName);
      meilisearchIndices.set(index, meiliIndex);
    }

    if (openSearch && !openSearchIndices.has(index)) {
      let indexName = openSearchPrefix ? `${openSearchPrefix}_${index}` : index;
      let exists = await openSearch.indices.exists({ index: indexName });
      if (!exists.body) {
        await openSearch.indices.create({ index: indexName });
      }
      openSearchIndices.add(index);
    }

    return {
      addDocuments: async (docs: any[], options: { primaryKey: string }) => {
        if (meiliSearch) {
          let meiliIndex = meilisearchIndices.get(index)!;
          await meiliIndex.addDocuments(docs, options);
        }

        if (openSearch) {
          let indexName = openSearchPrefix ? `${openSearchPrefix}_${index}` : index;
          let body = docs.flatMap(doc => [
            { index: { _index: indexName, _id: doc[options.primaryKey] } },
            doc
          ]);
          await openSearch.bulk({ refresh: true, body });
        }
      },

      search: async (
        query: string,
        options?: { limit?: number; filters?: Record<string, { $eq: string }> }
      ) => {
        if (meiliSearch) {
          let meiliIndex = meilisearchIndices.get(index)!;
          let result = await meiliIndex.search(query, {
            limit: options?.limit,
            filters: options?.filters
              ? Object.entries(options.filters).map(
                  ([key, value]) => `(${key} = "${value.$eq}")`
                )
              : undefined
          });

          return { hits: result.hits };
        }

        if (openSearch) {
          let indexName = openSearchPrefix ? `${openSearchPrefix}_${index}` : index;
          let body: any = {
            query: {
              bool: {
                must: [{ query_string: { query } }]
              }
            },
            size: options?.limit ?? 10
          };

          if (options?.filters) {
            body.query.bool.filter = Object.entries(options.filters).map(([key, value]) => ({
              term: { [key]: value.$eq }
            }));
          }

          let result = await openSearch.search({ index: indexName, body });

          return {
            hits: result.body.hits.hits.map(hit => hit._source)
          };
        }

        return { hits: [] };
      }
    };
  }

  async indexDocument<T extends { id: string }>(d: { index: SearchIndex; document: T | T[] }) {
    let index = await this.ensureIndex(d.index);
    if (!index) return;

    await index.addDocuments(Array.isArray(d.document) ? d.document : [d.document], {
      primaryKey: 'id'
    });
  }

  async search<T>(d: {
    index: SearchIndex;
    query: string;
    options?: {
      limit?: number;
      filters?: Record<string, { $eq: string }>;
    };
  }) {
    try {
      let index = await this.ensureIndex(d.index);
      if (!index) return [];

      let result = await index.search(d.query, d.options);
      return result.hits as T[];
    } catch (error: any) {
      if (error instanceof MeiliSearchApiError) {
        if (error.cause?.code == 'index_not_found') {
          return [];
        }
      }

      throw error;
    }
  }
}

export let searchService = Service.create('searchService', () => new SearchService()).build();
