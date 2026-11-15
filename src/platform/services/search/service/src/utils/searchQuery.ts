let SEARCH_QUERY_MAX_LENGTH = 512;

export let normalizeSearchQuery = (query: string) =>
  query
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_QUERY_MAX_LENGTH);
