import { isPublicIp, safeFetch } from '@lowerdeck/ssrf';
import { createScoutClient } from '@metorial-services/scout-client';
import { lookup } from 'node:dns/promises';
import { screenWebQuery, screenWebUrl, WebAccessError, webDomainForLog } from './webPolicy';
import { createWebRiskCheck, type WebReputation } from './webRisk';

let MAX_PAGE_CHARS = 200_000;
let FETCH_TIMEOUT_MS = 15_000;
let MAX_RESPONSE_BYTES = 1024 * 1024;

// Scout's bundled declarations lag behind the service and the workspace RPC client.
type ScoutRequestOptions = NonNullable<
  Parameters<ReturnType<typeof createScoutClient>['crawl']['search']>[1]
> & {
  signal: AbortSignal;
  retry: false;
  captureErrors: false;
};

export type WebSearchResult = {
  title: string;
  url: string;
  description?: string;
};

export type WebPage = {
  url: string;
  markdown: string;
};

export interface WebAccess {
  search(query: string, options?: { signal?: AbortSignal }): Promise<WebSearchResult[]>;
  fetch(url: string, options?: { signal?: AbortSignal }): Promise<WebPage>;
}

export type WebAccessEvent = {
  domain: string;
  operation: 'fetch' | 'search';
  outcome: 'succeeded' | 'blocked' | 'failed';
  dispatched: boolean;
  retriever: 'firecrawl' | 'direct';
  reason: string | null;
  reputation?: WebReputation;
  attemptedAt: Date;
  usedAt: Date | null;
};

let htmlToText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

let directFetch = async (
  url: string,
  signal: AbortSignal,
  assertUrl: (url: URL) => Promise<void>
): Promise<WebPage> => {
  let response = await safeFetch(url, {
    method: 'GET',
    signal,
    headers: { 'User-Agent': 'Metorial-Security-Review/1.0' },
    assertUrl,
    maxRedirects: 3
  });

  if (!response.ok || !response.body) throw new WebAccessError('fetch_failed');

  let reader = response.body.getReader();
  let chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      let { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new WebAccessError('response_too_large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  let body = Buffer.concat(chunks).toString('utf8');
  let isHtml = response.headers.get('content-type')?.includes('html') ?? false;

  return {
    url: response.url || url,
    markdown: (isHtml ? htmlToText(body) : body).slice(0, MAX_PAGE_CHARS)
  };
};

export let createWebAccess = (d: {
  scout?: { endpoint: string; token: string };
  webRiskApiKey?: string;
  containsSensitiveText?: (text: string) => boolean;
  onAccess: (event: WebAccessEvent) => Promise<void>;
  abortSignal?: AbortSignal;
}): WebAccess => {
  let scout = d.scout
    ? createScoutClient({
        endpoint: d.scout.endpoint,
        headers: { 'Scout-Auth': d.scout.token }
      })
    : undefined;
  let checkReputation = createWebRiskCheck(d.webRiskApiKey);

  let resolveHost = async (hostname: string, signal: AbortSignal) => {
    signal.throwIfAborted();

    return await new Promise<{ address: string }[]>((resolve, reject) => {
      let onAbort = () => reject(new WebAccessError('request_canceled'));
      signal.addEventListener('abort', onAbort, { once: true });

      lookup(hostname, { all: true }).then(
        addresses => {
          signal.removeEventListener('abort', onAbort);
          resolve(addresses);
        },
        error => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        }
      );
    });
  };

  let checkUrl = async (
    input: string,
    signal: AbortSignal,
    onReputation?: (value: WebReputation) => void
  ) => {
    let url = screenWebUrl(input, d.containsSensitiveText);
    signal.throwIfAborted();
    let addresses = await resolveHost(url.hostname, signal);
    if (!addresses.length || addresses.some(address => !isPublicIp(address.address))) {
      throw new WebAccessError('private_destination');
    }

    let reputation = await checkReputation(url.href, signal);
    signal.throwIfAborted();
    onReputation?.(reputation);
    if (reputation.verdict == 'unsafe') throw new WebAccessError('unsafe_url');

    return { url, reputation };
  };

  let requestSignal = (signal?: AbortSignal) =>
    AbortSignal.any([
      AbortSignal.timeout(FETCH_TIMEOUT_MS),
      ...[d.abortSignal, signal].filter((entry): entry is AbortSignal => !!entry)
    ]);

  return {
    async search(query, options) {
      let event: WebAccessEvent = {
        domain: 'api.firecrawl.dev',
        operation: 'search',
        outcome: 'blocked',
        dispatched: false,
        retriever: 'firecrawl',
        reason: null,
        attemptedAt: new Date(),
        usedAt: null
      };

      try {
        let screened = screenWebQuery(query, d.containsSensitiveText);
        if (!scout) throw new WebAccessError('search_unavailable');
        let signal = requestSignal(options?.signal);
        signal.throwIfAborted();

        let input: Parameters<typeof scout.crawl.search>[0] & { securityReview: true } = {
          query: screened,
          country: undefined,
          type: 'web',
          securityReview: true
        };
        let requestOptions: ScoutRequestOptions = {
          signal,
          retry: false,
          captureErrors: false
        };

        event.dispatched = true;
        event.usedAt = new Date();
        let results = await scout.crawl.search(input, requestOptions);
        event.outcome = 'succeeded';

        return results.flatMap(result => {
          try {
            let url = screenWebUrl(String(result.url), d.containsSensitiveText);
            return [
              {
                title: String(result.title ?? ''),
                url: url.href,
                description:
                  'description' in result ? String(result.description ?? '') : undefined
              }
            ];
          } catch {
            return [];
          }
        });
      } catch (error) {
        event.reason = error instanceof WebAccessError ? error.reason : 'search_failed';
        event.outcome = error instanceof WebAccessError ? 'blocked' : 'failed';
        throw new WebAccessError(event.reason);
      } finally {
        await d.onAccess(event);
      }
    },

    async fetch(input, options) {
      let event: WebAccessEvent = {
        domain: webDomainForLog(input),
        operation: 'fetch',
        outcome: 'blocked',
        dispatched: false,
        retriever: scout ? 'firecrawl' : 'direct',
        reason: null,
        attemptedAt: new Date(),
        usedAt: null
      };

      try {
        let signal = requestSignal(options?.signal);
        let checked = await checkUrl(input, signal, reputation => {
          event.reputation = reputation;
        });
        event.dispatched = true;
        event.usedAt = new Date();

        if (scout) {
          let input: Parameters<typeof scout.crawl.extract>[0] & { securityReview: true } = {
            url: checked.url.href,
            securityReview: true
          };
          let requestOptions: ScoutRequestOptions = {
            signal,
            retry: false,
            captureErrors: false
          };

          let page = await scout.crawl.extract(input, requestOptions);
          signal.throwIfAborted();
          if (!page.markdown) throw new WebAccessError('fetch_failed');

          // Firecrawl reports the final URL after retrieval; this does not police its internal redirects.
          let pageUrl = 'url' in page && typeof page.url == 'string' ? page.url : undefined;
          let final = await checkUrl(pageUrl ?? checked.url.href, signal);
          event.outcome = 'succeeded';
          return { url: final.url.href, markdown: page.markdown.slice(0, MAX_PAGE_CHARS) };
        }

        let page = await directFetch(checked.url.href, signal, async url => {
          await checkUrl(url.href, signal);
        });
        event.outcome = 'succeeded';
        return page;
      } catch (error) {
        event.reason = error instanceof WebAccessError ? error.reason : 'fetch_failed';
        event.outcome = error instanceof WebAccessError ? 'blocked' : 'failed';
        throw new WebAccessError(event.reason);
      } finally {
        await d.onAccess(event);
      }
    }
  };
};
