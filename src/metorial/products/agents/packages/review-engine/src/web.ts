import { safeFetch } from '@lowerdeck/ssrf';
import { createScoutClient } from '@metorial-services/scout-client';

let MAX_PAGE_CHARS = 200_000;
let FETCH_TIMEOUT_MS = 15_000;

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
  search(query: string): Promise<WebSearchResult[]>;
  fetch(url: string): Promise<WebPage>;
}

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

let directFetch = async (url: string): Promise<WebPage> => {
  let response = await safeFetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'Metorial-Security-Review/1.0' }
  });

  if (!response.ok) throw new Error(`Fetching ${url} failed with status ${response.status}`);

  let body = await response.text();
  let isHtml = response.headers.get('content-type')?.includes('html') ?? false;

  return {
    url: response.url || url,
    markdown: (isHtml ? htmlToText(body) : body).slice(0, MAX_PAGE_CHARS)
  };
};

export let createWebAccess = (d: {
  scout?: { endpoint: string; token: string };
}): WebAccess => {
  let scout = d.scout
    ? createScoutClient({
        endpoint: d.scout.endpoint,
        headers: { 'Scout-Auth': d.scout.token }
      })
    : undefined;

  return {
    async search(query) {
      if (!scout) return [];

      let results = await scout.crawl.search({ query, country: undefined, type: 'web' });
      return results
        .filter(result => typeof result.url == 'string')
        .map(result => ({
          title: String(result.title ?? ''),
          url: String(result.url),
          description: 'description' in result ? String(result.description ?? '') : undefined
        }));
    },

    async fetch(url) {
      if (scout) {
        try {
          let page = await scout.crawl.extract({ url });
          if (page.markdown) return { url, markdown: page.markdown.slice(0, MAX_PAGE_CHARS) };
        } catch {}
      }

      return await directFetch(url);
    }
  };
};
