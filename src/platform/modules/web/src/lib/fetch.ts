import { safeFetch } from '@lowerdeck/ssrf';
import {
  MAX_REDIRECTS,
  MAX_REQUESTS_PER_DISCOVERY,
  REQUEST_TIMEOUT_MS,
  USER_AGENT
} from './limits';

export type WebFetchErrorCode =
  | 'blocked_address'
  | 'invalid_url'
  | 'timeout'
  | 'network_error'
  | 'http_client_error'
  | 'http_server_error'
  | 'too_large'
  | 'unsupported_content_type'
  | 'budget_exhausted';

let retryableCodes: WebFetchErrorCode[] = ['timeout', 'network_error', 'http_server_error'];

export class WebFetchError extends Error {
  constructor(
    public code: WebFetchErrorCode,
    message?: string
  ) {
    super(message ?? code);
  }

  get isRetryable() {
    return retryableCodes.includes(this.code);
  }
}

export type FetchBudget = {
  requests: number;
  signal: AbortSignal;
};

export let createFetchBudget = (deadlineMs: number): FetchBudget => ({
  requests: 0,
  signal: AbortSignal.timeout(deadlineMs)
});

let assertPublicWebPort = (url: URL) => {
  if (url.port && url.port != '80' && url.port != '443') {
    throw new Error('Unsupported port');
  }
};

let classifyError = (error: unknown) => {
  if (error instanceof WebFetchError) return error;

  let message = error instanceof Error ? error.message : String(error);
  let name = error instanceof Error ? error.name : '';

  if (name == 'TimeoutError' || name == 'AbortError') return new WebFetchError('timeout');

  if (
    message.includes('Private or internal IP blocked') ||
    message.includes('Unsupported port')
  ) {
    return new WebFetchError('blocked_address', message);
  }

  if (
    message.includes('Unsupported protocol') ||
    message.includes('Credentials in URL') ||
    message.includes('Too many redirects') ||
    message.includes('Redirect with empty location') ||
    message.includes('Invalid URL')
  ) {
    return new WebFetchError('invalid_url', message);
  }

  return new WebFetchError('network_error', message);
};

export type ReadCappedOptions = {
  maxBytes: number;
  truncate?: boolean;
  stopAfter?: string;
};

export type ReadCappedResult = {
  bytes: Uint8Array;
  isTruncated: boolean;
};

export let readCapped = async (
  response: Response,
  opts: ReadCappedOptions
): Promise<ReadCappedResult> => {
  let declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (!opts.truncate && declaredLength > opts.maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new WebFetchError('too_large');
  }

  if (!response.body) return { bytes: new Uint8Array(0), isTruncated: false };

  let reader = response.body.getReader();
  let chunks: Uint8Array[] = [];
  let total = 0;
  let isTruncated = false;
  let scanTail = '';
  let latin1 = new TextDecoder('latin1');

  try {
    while (true) {
      let { done, value } = await reader.read();
      if (done || !value) break;

      let remaining = opts.maxBytes - total;

      if (value.length > remaining) {
        if (!opts.truncate) throw new WebFetchError('too_large');

        chunks.push(value.subarray(0, remaining));
        total += remaining;
        isTruncated = true;
        break;
      }

      chunks.push(value);
      total += value.length;

      if (opts.stopAfter) {
        scanTail = (scanTail + latin1.decode(value)).toLowerCase();

        if (scanTail.includes(opts.stopAfter)) {
          isTruncated = true;
          break;
        }

        scanTail = scanTail.slice(-opts.stopAfter.length);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  let bytes = new Uint8Array(total);
  let offset = 0;
  for (let chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return { bytes, isTruncated };
};

export type GuardedFetchResult = ReadCappedResult & {
  finalUrl: string;
  status: number;
  contentType: string | null;
};

export let guardedFetch = async (
  url: string,
  opts: ReadCappedOptions & { budget: FetchBudget; accept: string }
): Promise<GuardedFetchResult> => {
  if (opts.budget.requests >= MAX_REQUESTS_PER_DISCOVERY) {
    throw new WebFetchError('budget_exhausted');
  }
  opts.budget.requests++;

  try {
    let response = await safeFetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: opts.accept
      },
      maxRedirects: MAX_REDIRECTS,
      assertUrl: assertPublicWebPort,
      signal: AbortSignal.any([AbortSignal.timeout(REQUEST_TIMEOUT_MS), opts.budget.signal])
    });

    if (response.status >= 400) {
      await response.body?.cancel().catch(() => {});

      throw new WebFetchError(
        response.status >= 500 ? 'http_server_error' : 'http_client_error',
        `HTTP ${response.status}`
      );
    }

    let body = await readCapped(response, opts);

    return {
      ...body,
      finalUrl: response.url || url,
      status: response.status,
      contentType: response.headers.get('content-type')
    };
  } catch (error) {
    throw classifyError(error);
  }
};
