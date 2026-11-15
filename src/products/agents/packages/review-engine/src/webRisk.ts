import { safeFetch } from '@lowerdeck/ssrf';
import { v } from '@lowerdeck/validation';
import { WebAccessError } from './webPolicy';

let LOOKUP_TIMEOUT_MS = 5_000;
let CLEAN_CACHE_MS = 5 * 60 * 1000;
let MAX_CACHE_ENTRIES = 1000;

let verdictSchema = v.object({
  threat: v.optional(
    v.object({
      threatTypes: v.array(v.string()),
      expireTime: v.string()
    })
  )
});

export type WebReputation = {
  verdict: 'no_known_threats' | 'unsafe';
  threatTypes: string[];
  checkedAt: Date;
};

export let createWebRiskCheck = (apiKey: string | undefined) => {
  let cache = new Map<string, { reputation: WebReputation; expiresAt: number }>();

  return async (url: string, signal?: AbortSignal): Promise<WebReputation> => {
    signal?.throwIfAborted();
    if (!apiKey) throw new WebAccessError('reputation_unavailable');

    let cached = cache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.reputation;

    try {
      let endpoint = new URL('https://webrisk.googleapis.com/v1/uris:search');
      endpoint.searchParams.set('uri', url);
      for (let threat of ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE']) {
        endpoint.searchParams.append('threatTypes', threat);
      }

      let response = await safeFetch(endpoint.href, {
        method: 'GET',
        headers: { 'X-Goog-Api-Key': apiKey },
        signal: AbortSignal.any([
          AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
          ...(signal ? [signal] : [])
        ]),
        maxRedirects: 0
      });
      if (!response.ok) throw new WebAccessError('reputation_unavailable');

      let body: unknown = await response.json();
      let parsed = verdictSchema.validate(body);
      if (!parsed.success) throw new WebAccessError('reputation_unavailable');
      if (Object.keys(body as object).some(key => key != 'threat'))
        throw new WebAccessError('reputation_unavailable');

      let threat = parsed.value.threat;
      let reputation: WebReputation = {
        verdict: threat?.threatTypes.length ? 'unsafe' : 'no_known_threats',
        threatTypes: threat?.threatTypes ?? [],
        checkedAt: new Date()
      };
      let expiresAt = threat ? Date.parse(threat.expireTime) : Date.now() + CLEAN_CACHE_MS;
      if (!Number.isFinite(expiresAt)) throw new WebAccessError('reputation_unavailable');

      if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
      cache.set(url, { reputation, expiresAt });

      return reputation;
    } catch {
      throw new WebAccessError('reputation_unavailable');
    }
  };
};
