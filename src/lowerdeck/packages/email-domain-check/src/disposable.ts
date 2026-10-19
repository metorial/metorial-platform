import { getDomainWithParents, normalizeDomain } from './domain';

let DEFAULT_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
let DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export type DisposableDomainSourceFormat = 'lines' | 'json-array';

export interface DisposableDomainSource {
  name: string;
  url: string;
  format: DisposableDomainSourceFormat;
}

export let defaultDisposableDomainSources: DisposableDomainSource[] = [
  {
    name: 'wesbos/burner-email-providers',
    url: 'https://raw.githubusercontent.com/wesbos/burner-email-providers/master/emails.txt',
    format: 'lines'
  },
  {
    name: 'disposable/disposable-email-domains',
    url: 'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt',
    format: 'lines'
  },
  {
    name: 'ivolo/disposable-email-domains',
    url: 'https://raw.githubusercontent.com/ivolo/disposable-email-domains/master/index.json',
    format: 'json-array'
  },
  {
    name: 'andreis/disposable-email-domains',
    url: 'https://raw.githubusercontent.com/andreis/disposable-email-domains/master/domains.txt',
    format: 'lines'
  },
  {
    name: 'martenson/disposable-email-domains',
    url: 'https://raw.githubusercontent.com/martenson/disposable-email-domains/master/disposable_email_blocklist.conf',
    format: 'lines'
  }
];

let isPlausibleDomain = (domain: string) => domain.includes('.') && !/\s/.test(domain);

export let parseDisposableDomainList = (
  body: string,
  format: DisposableDomainSourceFormat
) => {
  let entries: unknown[];

  if (format === 'json-array') {
    let parsed = JSON.parse(body);
    entries = Array.isArray(parsed) ? parsed : [];
  } else {
    entries = body.split(/\r?\n/).filter(line => !line.trim().startsWith('#'));
  }

  return entries
    .filter((entry): entry is string => typeof entry === 'string')
    .map(normalizeDomain)
    .filter(isPlausibleDomain);
};

let fetchWithTimeout = async (fetcher: typeof fetch, url: string, timeoutMs: number) => {
  let controller = new AbortController();
  let timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res = await fetcher(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
};

export let createDisposableEmailDomains = (
  opts: {
    sources?: DisposableDomainSource[];
    allowlist?: string[];
    refreshIntervalMs?: number;
    fetchTimeoutMs?: number;
    fetch?: typeof fetch;
  } = {}
) => {
  let sources = opts.sources ?? defaultDisposableDomainSources;
  let allowlist = new Set((opts.allowlist ?? []).map(normalizeDomain));
  let refreshIntervalMs = opts.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
  let fetchTimeoutMs = opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  let fetcher = opts.fetch ?? fetch;

  let domains: Set<string> | null = null;
  let loadedAt = 0;
  let inflight: Promise<void> | null = null;

  let load = async () => {
    let results = await Promise.allSettled(
      sources.map(async source =>
        parseDisposableDomainList(
          await fetchWithTimeout(fetcher, source.url, fetchTimeoutMs),
          source.format
        )
      )
    );

    let next = new Set<string>();
    let succeeded = 0;

    for (let result of results) {
      if (result.status !== 'fulfilled') continue;

      succeeded++;
      for (let domain of result.value) next.add(domain);
    }

    // Keep serving the previous list rather than replacing it with an empty or partial one.
    if (succeeded === 0) {
      if (!domains) domains = new Set();
      return;
    }

    domains = next;
    loadedAt = Date.now();
  };

  let refresh = async () => {
    if (!inflight) {
      inflight = load().finally(() => {
        inflight = null;
      });
    }

    await inflight;
  };

  let ensureLoaded = async () => {
    if (!domains) {
      await refresh();
      return;
    }

    if (Date.now() - loadedAt > refreshIntervalMs) {
      void refresh().catch(() => {});
    }
  };

  return {
    refresh,

    isDisposable: async (domain: string) => {
      await ensureLoaded();

      let candidates = getDomainWithParents(domain);
      if (candidates.some(candidate => allowlist.has(candidate))) return false;

      return candidates.some(candidate => domains!.has(candidate));
    },

    size: () => domains?.size ?? 0
  };
};

export let disposableEmailDomains = createDisposableEmailDomains();
