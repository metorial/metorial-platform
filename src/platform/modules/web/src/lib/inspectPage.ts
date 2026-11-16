import {
  guardedFetch,
  WebFetchError,
  type FetchBudget,
  type GuardedFetchResult
} from './fetch';
import {
  parseManifestIcons,
  parseWebPage,
  resolveUrl,
  type CandidateSeed,
  type ParsedWebPage
} from './html';
import { ImageRejectedError, probeImage } from './imageProbe';
import {
  MAX_CANDIDATES_PER_PAGE,
  MAX_HTML_BYTES,
  MAX_MANIFEST_BYTES,
  MAX_PROBES_PER_PAGE
} from './limits';
import { isGoodScore, scoreCandidate } from './rank';

let wellKnownPaths = ['/apple-touch-icon.png', '/favicon.svg', '/favicon.ico'];

export type InspectedPage = Pick<
  ParsedWebPage,
  'title' | 'description' | 'siteName' | 'lang' | 'themeColor' | 'canonicalUrl'
> & {
  finalUrl: string | null;
  httpStatus: number | null;
  contentType: string | null;
  bytesRead: number | null;
  errorCode: string | null;
  candidates: PrismaJson.WebImageCandidate[];
};

let emptyPage = (errorCode: string): InspectedPage => ({
  finalUrl: null,
  httpStatus: null,
  contentType: null,
  bytesRead: null,
  errorCode,
  title: null,
  description: null,
  siteName: null,
  lang: null,
  themeColor: null,
  canonicalUrl: null,
  candidates: []
});

let decodeBody = (bytes: Uint8Array, contentType: string | null) => {
  let charset = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];

  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
};

let fetchHtml = async (url: string, budget: FetchBudget) => {
  let fetchOnce = (target: string) =>
    guardedFetch(target, {
      budget,
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      maxBytes: MAX_HTML_BYTES,
      truncate: true,
      stopAfter: '</head>'
    });

  try {
    return await fetchOnce(url);
  } catch (error) {
    if (error instanceof WebFetchError && error.code == 'network_error') {
      return await fetchOnce(url.replace(/^https:/, 'http:'));
    }

    throw error;
  }
};

let fetchManifestSeeds = async (manifestUrl: string, budget: FetchBudget) => {
  try {
    let manifest = await guardedFetch(manifestUrl, {
      budget,
      accept: 'application/manifest+json,application/json;q=0.9,*/*;q=0.1',
      maxBytes: MAX_MANIFEST_BYTES
    });

    return parseManifestIcons(
      new TextDecoder('utf-8').decode(manifest.bytes),
      manifest.finalUrl
    );
  } catch {
    return [];
  }
};

let toCandidate = (seed: CandidateSeed): PrismaJson.WebImageCandidate => {
  let result = scoreCandidate({
    source: seed.source,
    format: null,
    width: null,
    height: null,
    declaredWidth: seed.declaredWidth,
    declaredHeight: seed.declaredHeight
  });

  return {
    ...seed,
    width: null,
    height: null,
    format: null,
    bytes: null,
    score: result.score,
    rejectedReason: result.rejectedReason
  };
};

let probeCandidates = async (
  candidates: PrismaJson.WebImageCandidate[],
  budget: FetchBudget
) => {
  let order = candidates
    .filter(c => !c.rejectedReason)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PROBES_PER_PAGE);

  for (let candidate of order) {
    try {
      let probe = await probeImage(candidate.url, budget);

      candidate.format = probe.format;
      candidate.width = probe.width;
      candidate.height = probe.height;
      candidate.bytes = probe.bytes;

      let result = scoreCandidate(candidate);
      candidate.score = result.score;
      candidate.rejectedReason = result.rejectedReason;
    } catch (error) {
      candidate.score = null;
      candidate.rejectedReason =
        error instanceof ImageRejectedError
          ? error.reason
          : error instanceof WebFetchError
            ? error.code
            : 'probe_failed';

      if (error instanceof WebFetchError && error.code == 'budget_exhausted') break;
      continue;
    }

    if (candidate.score !== null && isGoodScore(candidate.score)) break;
  }

  return candidates;
};

export let inspectPage = async (d: {
  url: string;
  budget: FetchBudget;
  isSiteRoot: boolean;
}): Promise<InspectedPage> => {
  let response: GuardedFetchResult;
  try {
    response = await fetchHtml(d.url, d.budget);
  } catch (error) {
    return emptyPage(error instanceof WebFetchError ? error.code : 'network_error');
  }

  let isHtml = /html/i.test(response.contentType ?? '');
  if (!isHtml) {
    return {
      ...emptyPage('unsupported_content_type'),
      finalUrl: response.finalUrl,
      httpStatus: response.status,
      contentType: response.contentType?.slice(0, 200) ?? null
    };
  }

  let parsed = parseWebPage(
    decodeBody(response.bytes, response.contentType),
    response.finalUrl
  );

  let seeds = [...parsed.candidates];
  let addSeeds = (extra: CandidateSeed[]) => {
    for (let seed of extra) {
      if (!seeds.some(s => s.url == seed.url)) seeds.push(seed);
    }
  };

  if (parsed.manifestUrl) addSeeds(await fetchManifestSeeds(parsed.manifestUrl, d.budget));

  if (d.isSiteRoot) {
    addSeeds(
      wellKnownPaths
        .map(path => resolveUrl(path, response.finalUrl, { httpsOnly: true }))
        .filter((url): url is string => !!url)
        .map(url => ({
          url,
          source: 'well_known' as const,
          declaredWidth: null,
          declaredHeight: null
        }))
    );
  }

  let candidates = await probeCandidates(
    seeds.slice(0, MAX_CANDIDATES_PER_PAGE).map(toCandidate),
    d.budget
  );

  return {
    finalUrl: response.finalUrl,
    httpStatus: response.status,
    contentType: response.contentType?.slice(0, 200) ?? null,
    bytesRead: response.bytes.length,
    errorCode: null,
    title: parsed.title,
    description: parsed.description,
    siteName: parsed.siteName,
    lang: parsed.lang,
    themeColor: parsed.themeColor,
    canonicalUrl: parsed.canonicalUrl,
    candidates
  };
};
