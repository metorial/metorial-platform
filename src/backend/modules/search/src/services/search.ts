import { Service } from '@metorial/service';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import { algoliasearch, SearchClient } from 'algoliasearch';
import createAwsOpensearchConnector from 'aws-opensearch-connector';
import { MeiliSearch, MeiliSearchApiError, Index as MeiliSearchIndex } from 'meilisearch';
import { env } from '../env';

export type SearchIndex = 'server_listing';

let meilisearchIndices = new Map<string, MeiliSearchIndex>();
let openSearchIndices = new Set<string>();

let meilisearchPrefix = env.meiliSearch.MEILISEARCH_INDEX_PREFIX;
let openSearchPrefix = env.openSearch.OPENSEARCH_INDEX_PREFIX;
let algoliaPrefix = env.algolia.ALGOLIA_INDEX_PREFIX;

export let meiliSearch = env.meiliSearch.MEILISEARCH_HOST
  ? new MeiliSearch({
      host: env.meiliSearch.MEILISEARCH_HOST,
      apiKey: env.meiliSearch.MEILISEARCH_API_KEY
    })
  : undefined;

export let openSearch = env.openSearch?.OPENSEARCH_HOST
  ? new OpenSearchClient(
      env.openSearch.OPENSEARCH_AWS_MODE == 'true'
        ? {
            ...createAwsOpensearchConnector({
              region: process.env.AWS_REGION || 'us-east-1',
              getCredentials: async () => ({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                sessionToken: process.env.AWS_SESSION_TOKEN
              })
            }),
            node: env.openSearch.OPENSEARCH_HOST
          }
        : {
            node: env.openSearch.OPENSEARCH_HOST,
            ssl:
              env.openSearch.OPENSEARCH_PROTOCOL === 'https'
                ? { rejectUnauthorized: false }
                : undefined,
            auth: {
              username: env.openSearch.OPENSEARCH_USERNAME!,
              password: env.openSearch.OPENSEARCH_PASSWORD!
            }
          }
    )
  : undefined;

export let algoliaSearch: SearchClient | undefined =
  env.algolia.ALGOLIA_APP_ID && env.algolia.ALGOLIA_ADMIN_KEY
    ? algoliasearch(env.algolia.ALGOLIA_APP_ID, env.algolia.ALGOLIA_ADMIN_KEY)
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
          await openSearch.bulk({
            refresh: true,
            body: docs.flatMap(doc => [
              { index: { _index: indexName, _id: doc[options.primaryKey] } },
              doc
            ])
          });
        }

        if (algoliaSearch) {
          await algoliaSearch.saveObjects({
            indexName: algoliaPrefix ? `${algoliaPrefix}_${index}` : index,
            objects: docs.map(doc => ({
              ...doc,
              objectID: doc[options.primaryKey]
            }))
          });
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
            // Translate filters to MeiliSearch's SQL-like syntax
            filter: options?.filters
              ? Object.entries(options.filters)
                  .map(([key, value]) => `${key} = "${value.$eq}"`)
                  .join(' AND ')
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
              term: { [`${key}.keyword`]: value.$eq } // Use .keyword for exact matches on text fields
            }));
          }

          let result = await openSearch.search({ index: indexName, body });
          return {
            hits: result.body.hits.hits.map((hit: any) => hit._source)
          };
        }

        if (algoliaSearch) {
          let searchOptions: any = {
            hitsPerPage: options?.limit
          };

          if (options?.filters) {
            // Translate filters to Algolia's syntax (e.g., 'facet:value')
            searchOptions.filters = Object.entries(options.filters)
              .map(([key, value]) => `${key}:${value.$eq}`)
              .join(' AND ');
          }

          let result = await algoliaSearch.searchSingleIndex({
            indexName: algoliaPrefix ? `${algoliaPrefix}_${index}` : index,
            searchParams: {
              query,
              ...searchOptions
            }
          });
          return { hits: result.hits };
        }

        return { hits: [] };
      }
    };
  }

  async indexDocument<T extends { id: string }>(d: { index: SearchIndex; document: T | T[] }) {
    try {
      let index = await this.ensureIndex(d.index);
      if (!index) return;

      await index.addDocuments(Array.isArray(d.document) ? d.document : [d.document], {
        primaryKey: 'id'
      });
    } catch (error: any) {
      console.error('Error indexing document:', JSON.stringify(error, null, 2));
    }
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

      // Add similar specific error handling for OpenSearch and Algolia if needed
      throw error;
    }
  }
}

export let searchService = Service.create('searchService', () => new SearchService()).build();
