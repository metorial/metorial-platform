import { MeiliSearch } from 'meilisearch';
import { env } from './env';

export let meiliSearch = env.meiliSearch.MEILISEARCH_HOST
  ? new MeiliSearch({
      host: env.meiliSearch.MEILISEARCH_HOST,
      apiKey: env.meiliSearch.MEILISEARCH_API_KEY
    })
  : undefined;
