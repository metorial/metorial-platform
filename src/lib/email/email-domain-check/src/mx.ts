import { normalizeDomain } from './domain';

let DEFAULT_MX_TIMEOUT_MS = 5_000;
let DNS_RESPONSE_NOERROR = 0;
let DNS_RESPONSE_NXDOMAIN = 3;
let DNS_RECORD_TYPE_MX = 15;

export class MxLookupError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'MxLookupError';
  }
}

interface DnsJsonResponse {
  Status: number;
  Answer?: { type: number; data: string }[];
}

export let hasMxRecords = async (
  domain: string,
  opts: { timeoutMs?: number; fetch?: typeof fetch } = {}
) => {
  let fetcher = opts.fetch ?? fetch;
  let controller = new AbortController();
  let timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_MX_TIMEOUT_MS);

  let response: DnsJsonResponse;

  try {
    let url = `https://dns.google/resolve?name=${encodeURIComponent(normalizeDomain(domain))}&type=MX`;
    let res = await fetcher(url, {
      signal: controller.signal,
      headers: { accept: 'application/dns-json' }
    });
    if (!res.ok) throw new MxLookupError(`DNS lookup failed with status ${res.status}`);

    response = (await res.json()) as DnsJsonResponse;
  } catch (err) {
    if (err instanceof MxLookupError) throw err;
    throw new MxLookupError('DNS lookup failed', err);
  } finally {
    clearTimeout(timeout);
  }

  if (response.Status === DNS_RESPONSE_NXDOMAIN) return false;
  if (response.Status !== DNS_RESPONSE_NOERROR) {
    throw new MxLookupError(`DNS lookup returned status ${response.Status}`);
  }

  return (response.Answer ?? []).some(
    answer => answer.type === DNS_RECORD_TYPE_MX && answer.data.trim() !== '0 .'
  );
};
