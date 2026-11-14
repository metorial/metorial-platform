import { getDomain } from 'tldts';
import { MAX_PAGES_PER_DISCOVERY, MAX_URL_LENGTH } from './limits';

export type NormalizedWebUrl = {
  urlKey: string;
  pageUrl: string;
  host: string;
  pathname: string;
  registrableDomain: string | null;
};

export let normalizeWebUrl = (input: string): NormalizedWebUrl | null => {
  if (typeof input !== 'string' || input.length > MAX_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.protocol != 'http:' && url.protocol != 'https:') return null;
  if (!url.hostname) return null;

  let host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return null;

  let pathname = url.pathname.replace(/\/+$/, '') || '/';
  let urlKey = `${host}${pathname == '/' ? '' : pathname}`;
  if (urlKey.length > MAX_URL_LENGTH) return null;

  return {
    urlKey,
    pageUrl: `https://${host}${pathname == '/' ? '/' : pathname}`,
    host,
    pathname,
    registrableDomain: getDomain(host, { allowPrivateDomains: true }) ?? null
  };
};

export let buildPageChain = (d: {
  host: string;
  pathname: string;
  registrableDomain: string | null;
}) => {
  let pages: string[] = [];

  if (d.pathname != '/') pages.push(`https://${d.host}${d.pathname}`);
  pages.push(`https://${d.host}/`);

  if (d.registrableDomain && d.host != d.registrableDomain) {
    let labels = d.host.split('.');

    for (let i = 1; i < labels.length; i++) {
      let parent = labels.slice(i).join('.');
      if (parent.length < d.registrableDomain.length) break;

      pages.push(`https://${parent}/`);
      if (parent == d.registrableDomain) break;
    }
  }

  if (pages.length <= MAX_PAGES_PER_DISCOVERY) return pages;

  return [...pages.slice(0, MAX_PAGES_PER_DISCOVERY - 1), pages[pages.length - 1]!];
};
