import {
  createRequesterFn,
  getMatchingRateLimiter,
  GitbeakerRequestError,
  GitbeakerRetryError,
  GitbeakerTimeoutError,
  type RateLimiters,
  type RequestOptions
} from '@gitbeaker/requester-utils';
import { delay } from '@lowerdeck/delay';
import { scmFetch } from './scmFetch';

let retryStatuses = [429, 502];
let maxRetries = 10;

let readBody = async (response: Response) => {
  let contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim();

  if (contentType === 'application/json') return (await response.json()) || {};
  if (contentType.startsWith('text/')) return (await response.text()) || '';
  return await response.blob();
};

let toRequestError = async (request: Request, response: Response) => {
  let content = await response.text();
  let description = content;

  if (response.headers.get('content-type')?.includes('application/json')) {
    let output = JSON.parse(content);
    let property = output?.error || output?.message || '';
    description = typeof property === 'string' ? property : JSON.stringify(property);
  }

  return new GitbeakerRequestError(description, {
    cause: { description, request, response }
  });
};

let requestHandler = async (endpoint: string, options?: Record<string, unknown>) => {
  let {
    rateLimiters,
    agent: _agent,
    asStream,
    prefixUrl,
    searchParams,
    method,
    ...init
  } = (options ?? {}) as RequestOptions & { rateLimiters?: RateLimiters };

  let rateLimit = getMatchingRateLimiter(endpoint, rateLimiters, method);
  let baseUrl = prefixUrl
    ? prefixUrl.endsWith('/')
      ? prefixUrl
      : `${prefixUrl}/`
    : undefined;
  let url = new URL(endpoint, baseUrl);
  url.search = searchParams || '';

  let lastStatus: number | undefined;

  for (let i = 0; i < maxRetries; i++) {
    await rateLimit();

    let response = await scmFetch(url, { ...init, method }).catch(error => {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new GitbeakerTimeoutError('Query timeout was reached');
      }
      throw error;
    });

    if (response.ok) {
      return {
        body: asStream
          ? (response.body as ReadableStream)
          : response.status === 204
            ? null
            : await readBody(response),
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status
      };
    }

    if (!retryStatuses.includes(response.status)) {
      throw await toRequestError(new Request(url, { method }), response);
    }

    lastStatus = response.status;
    await delay(2 ** i * 0.25);
  }

  throw new GitbeakerRetryError(
    `Could not successfully complete this request after ${maxRetries} retries, last status code: ${lastStatus}.`
  );
};

export let gitlabRequesterFn = createRequesterFn(
  async (_, requestOptions) => requestOptions,
  requestHandler
);
