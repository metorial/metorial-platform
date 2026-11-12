export let searchProviders = ['linkup', 'exa', 'ceramic'] as const;

export type SearchProvider = (typeof searchProviders)[number];

let gatewayId = 'default';
let resultLimit = 4;
let snippetLimit = 500;
let titleLimit = 160;
let requestTimeoutMs = 20_000;
let retries = 1;
let defaultMaxSearches = 400;
let queryLimit = 1_000;

// Cloudflare answers these when the token, gateway or credit balance is wrong; none of them
// gets better by asking again, so searching stops for the rest of the run.
let fatalStatuses = new Set([400, 401, 402, 403]);

export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
}

export interface WebSearchOptions {
  accountId: string;
  apiToken: string;
  provider: SearchProvider;
  maxSearches?: number;
}

export interface WebSearch {
  (query: string): Promise<WebSearchResult[] | null>;
  stats: { searches: number; failures: number; stoppedBecause: string | null };
}

let clean = (value: unknown, limit: number) => {
  let text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
};

export let searchQuery = (vendorModelId: string, name: string | null | undefined) => {
  let id = vendorModelId.replace(/^@(cf|hf)\//, '');
  let label = name && name.toLowerCase() !== id.toLowerCase() ? ` ${name}` : '';
  return `${id}${label} AI model`.slice(0, queryLimit);
};

export let createWebSearch = (opts: WebSearchOptions): WebSearch => {
  let maxSearches = opts.maxSearches ?? defaultMaxSearches;
  let cache = new Map<string, Promise<WebSearchResult[] | null>>();

  let request = async (query: string) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        let response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/ai/websearch/`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${opts.apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query,
              provider: opts.provider,
              limit: resultLimit,
              options: { gateway: { id: gatewayId } }
            }),
            signal: AbortSignal.timeout(requestTimeoutMs)
          }
        );

        if (response.ok) {
          let body = (await response.json()) as { items?: Record<string, unknown>[] };
          return (body.items ?? []).slice(0, resultLimit).flatMap(item =>
            typeof item.url === 'string'
              ? [
                  {
                    url: item.url,
                    title: clean(item.title, titleLimit),
                    snippet: clean(item.description, snippetLimit)
                  }
                ]
              : []
          );
        }

        if (fatalStatuses.has(response.status)) {
          let body = (await response.json().catch(() => null)) as {
            error?: { code?: string };
          } | null;
          search.stats.stoppedBecause = `HTTP ${response.status}${
            body?.error?.code ? ` ${body.error.code}` : ''
          }`;
          return null;
        }
      } catch {}
    }

    return null;
  };

  let search = (async (query: string) => {
    if (search.stats.stoppedBecause) return null;

    let cached = cache.get(query);
    if (cached) return cached;

    if (search.stats.searches >= maxSearches) {
      search.stats.stoppedBecause = `search limit of ${maxSearches} reached`;
      return null;
    }

    search.stats.searches++;
    let pending = request(query).then(results => {
      if (!results) search.stats.failures++;
      return results;
    });
    cache.set(query, pending);

    return pending;
  }) as WebSearch;

  search.stats = { searches: 0, failures: 0, stoppedBecause: null };

  return search;
};
