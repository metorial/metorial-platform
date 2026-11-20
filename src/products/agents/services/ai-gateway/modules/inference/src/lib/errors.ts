import { APICallError } from '@ai-sdk/provider';
import { isServiceError } from '@lowerdeck/error';
import type { GatewayError } from '@mtsrc/ai-gateway-dialects';
import { getProviderDefinition } from '@mtsrc/ai-gateway-providers';

export let toGatewayError = (error: unknown): GatewayError => {
  if (isServiceError(error)) {
    let data = error.data as { status: number; code: string; message: string };
    return { status: data.status, code: data.code, message: data.message };
  }

  return {
    status: 500,
    code: 'internal_server_error',
    message: 'An internal error occurred.'
  };
};

export type UpstreamFailure = {
  error: GatewayError;
  retryable: boolean;
  authFailure: boolean;
  httpStatus?: number;
  providerCode?: string;
  retryAfter?: string;
};

export type FailedCandidate = {
  providerSlug: string;
  connectionOwner: 'customer' | 'platform';
};

let readProviderError = (body: string | undefined) => {
  if (!body) return {};

  try {
    let parsed = JSON.parse(body);
    let error = Array.isArray(parsed) ? parsed[0]?.error : (parsed?.error ?? parsed);
    let message = typeof error == 'string' ? error : error?.message;
    let code = error?.code ?? error?.type ?? error?.status;

    return {
      message: typeof message == 'string' ? message : undefined,
      code: typeof code == 'string' ? code : undefined
    };
  } catch {
    return {};
  }
};

let providerName = (candidate: FailedCandidate) => {
  if (candidate.connectionOwner == 'platform') return 'The model provider';

  try {
    return getProviderDefinition(candidate.providerSlug).name;
  } catch {
    return candidate.providerSlug;
  }
};

export let isAbortError = (error: unknown) =>
  error instanceof Error && (error.name == 'AbortError' || error.name == 'TimeoutError');

// Every error a provider can produce maps to one gateway error. Whether a failure is retryable
// decides fallback: a request the provider rejected as invalid would be rejected by the next
// provider too, everything else (auth, limits, outages, missing models) may succeed elsewhere.
export let classifyUpstreamError = (
  error: unknown,
  candidate: FailedCandidate
): UpstreamFailure => {
  let name = providerName(candidate);

  if (APICallError.isInstance(error)) {
    let status = error.statusCode;
    let provider = readProviderError(error.responseBody);
    let detail = provider.message ? `: ${provider.message}` : '.';
    let base = { httpStatus: status, providerCode: provider.code };

    if (status == 401 || status == 403) {
      return {
        ...base,
        retryable: true,
        authFailure: true,
        error: {
          status: 502,
          code: 'upstream_authentication_failed',
          message:
            candidate.connectionOwner == 'customer'
              ? `${name} rejected the credentials of your provider connection${detail}`
              : 'The model provider is temporarily unavailable.'
        }
      };
    }

    if (status == 429) {
      return {
        ...base,
        retryable: true,
        authFailure: false,
        retryAfter: error.responseHeaders?.['retry-after'],
        error: {
          status: 429,
          code: 'upstream_rate_limited',
          message: `${name} is rate limiting requests${detail}`
        }
      };
    }

    if (status == 400 || status == 413 || status == 422) {
      return {
        ...base,
        retryable: false,
        authFailure: false,
        error: {
          status: status == 413 ? 413 : 400,
          code: 'upstream_invalid_request',
          message: `${name} rejected the request${detail}`
        }
      };
    }

    if (status == 404) {
      return {
        ...base,
        retryable: true,
        authFailure: false,
        error: {
          status: 502,
          code: 'upstream_model_unavailable',
          message: `${name} does not serve the requested model right now${detail}`
        }
      };
    }

    if (status == 408 || status == 504) {
      return {
        ...base,
        retryable: true,
        authFailure: false,
        error: { status: 504, code: 'upstream_timeout', message: `${name} timed out.` }
      };
    }

    if (status == 503 || status == 529) {
      return {
        ...base,
        retryable: true,
        authFailure: false,
        error: {
          status: 503,
          code: 'upstream_overloaded',
          message: `${name} is overloaded${detail}`
        }
      };
    }

    return {
      ...base,
      retryable: status === undefined || status >= 500 || status == 409,
      authFailure: false,
      error: {
        status: 502,
        code: 'upstream_error',
        message: `${name} returned an error${detail}`
      }
    };
  }

  if (
    error instanceof TypeError ||
    (error instanceof Error && /fetch failed|ECONN|ETIMEDOUT|socket/i.test(error.message))
  ) {
    return {
      retryable: true,
      authFailure: false,
      error: {
        status: 502,
        code: 'upstream_unreachable',
        message: `${name} could not be reached.`
      }
    };
  }

  return {
    retryable: true,
    authFailure: false,
    error: {
      status: 502,
      code: 'upstream_error',
      message: `${name} returned an unexpected response.`
    }
  };
};

export let incompleteStreamError: GatewayError = {
  status: 502,
  code: 'upstream_incomplete',
  message: 'The model provider ended the response before it was complete.'
};

export let connectionUnavailableError = (candidate: FailedCandidate): UpstreamFailure => ({
  retryable: true,
  authFailure: false,
  error: {
    status: 502,
    code: 'connection_unavailable',
    message:
      candidate.connectionOwner == 'customer'
        ? `The ${providerName(candidate)} connection could not be used.`
        : 'The model provider is temporarily unavailable.'
  }
});
