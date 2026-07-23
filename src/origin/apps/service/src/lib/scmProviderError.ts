import {
  badRequestError,
  conflictError,
  forbiddenError,
  internalServerError,
  isServiceError,
  notFoundError,
  ServiceError,
  timeoutError,
  tooManyRequestsError,
  unauthorizedError
} from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { status as grpcStatus } from '@grpc/grpc-js';

let Sentry = getSentry();

type ScmProvider = 'github' | 'gitlab' | 'bitbucket';

let getEmbeddedHttpStatus = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  let match = value.match(/\bstatus(?: code)?[\s:=()]+(\d{3})\b/i);
  if (!match) return undefined;

  let status = Number(match[1]);
  return Number.isInteger(status) ? status : undefined;
};

export let getScmProviderErrorStatus = (error: any): number | undefined =>
  error?.status ??
  error?.response?.status ??
  error?.cause?.response?.status ??
  error?.cause?.response?.statusCode ??
  getEmbeddedHttpStatus(error?.details) ??
  getEmbeddedHttpStatus(error instanceof Error ? error.message : error);

let getHeader = (headers: any, name: string) => {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;

  let entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );
  return typeof entry?.[1] === 'string' ? entry[1] : undefined;
};

let sanitizeText = (value: unknown, maxLength = 1000): string | undefined => {
  if (value == null) return undefined;

  let text: string;
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      return undefined;
    }
  }

  text = text
    .replace(
      /("(?:authorization|private-token|access[_-]?token|refresh[_-]?token)"\s*:\s*")[^"]*"/gi,
      '$1[redacted]"'
    )
    .replace(
      /(authorization|private-token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*[^,\s}"']+/gi,
      '$1=[redacted]'
    )
    .replace(/bearer\s+[a-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .trim();

  if (!text) return undefined;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
};

let getDescription = (error: any) => {
  let candidates = [
    error?.cause?.description,
    error?.description,
    error?.details,
    error?.response?.data?.message,
    error?.response?.data?.error,
    error?.cause?.response?.data?.message,
    error?.cause?.response?.data?.error
  ];

  for (let candidate of candidates) {
    let value = sanitizeText(candidate);
    if (value) return value;
  }

  return sanitizeText(error instanceof Error ? error.message : error);
};

let getRequest = (error: any) => error?.cause?.request ?? error?.request;
let getResponse = (error: any) => error?.cause?.response ?? error?.response;

let getSanitizedEndpoint = (error: any) => {
  let url = getRequest(error)?.url ?? getResponse(error)?.url;
  if (typeof url !== 'string') return undefined;

  try {
    let parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return sanitizeText(url.split('?')[0], 500);
  }
};

export type ScmProviderErrorDetails = {
  status?: number;
  description?: string;
  method?: string;
  endpoint?: string;
  requestId?: string;
  classification:
    | 'protected_branch'
    | 'missing_branch'
    | 'permission_denied'
    | 'authentication_failed'
    | 'resource_not_found'
    | 'conflict'
    | 'rate_limited'
    | 'timeout'
    | 'invalid_request'
    | 'upstream_failure'
    | 'network_failure';
};

let classifyScmProviderError = (
  status: number | undefined,
  description: string | undefined,
  grpcCode?: number
) => {
  let normalized = description?.toLowerCase() ?? '';
  if (
    normalized.includes('protected branch') ||
    normalized.includes('protected ref') ||
    normalized.includes('is protected') ||
    normalized.includes('was protected') ||
    normalized.includes('not allowed to push into this branch') ||
    normalized.includes('branch restriction') ||
    normalized.includes('pre-receive hook declined')
  ) {
    return 'protected_branch' as const;
  }
  if (normalized.includes('branch not found') || normalized.includes('reference not found')) {
    return 'missing_branch' as const;
  }
  if (status === 401) return 'authentication_failed' as const;
  if (status === 403) return 'permission_denied' as const;
  if (status === 404) return 'resource_not_found' as const;
  if (status === 409) return 'conflict' as const;
  if (status === 429) return 'rate_limited' as const;
  if (status === 408 || status === 504) return 'timeout' as const;
  if (status === 400 || status === 422) return 'invalid_request' as const;
  if (status != null && status >= 500) return 'upstream_failure' as const;

  if (grpcCode === grpcStatus.UNAUTHENTICATED) return 'authentication_failed' as const;
  if (grpcCode === grpcStatus.PERMISSION_DENIED) return 'permission_denied' as const;
  if (grpcCode === grpcStatus.NOT_FOUND) return 'resource_not_found' as const;
  if (grpcCode === grpcStatus.ABORTED || grpcCode === grpcStatus.ALREADY_EXISTS) {
    return 'conflict' as const;
  }
  if (grpcCode === grpcStatus.RESOURCE_EXHAUSTED) return 'rate_limited' as const;
  if (grpcCode === grpcStatus.DEADLINE_EXCEEDED) return 'timeout' as const;
  if (
    grpcCode === grpcStatus.INVALID_ARGUMENT ||
    grpcCode === grpcStatus.FAILED_PRECONDITION
  ) {
    return 'invalid_request' as const;
  }
  if (grpcCode === grpcStatus.UNAVAILABLE) return 'upstream_failure' as const;
  return 'network_failure' as const;
};

export let getScmProviderErrorDetails = (error: unknown): ScmProviderErrorDetails => {
  let value = error as any;
  let request = getRequest(value);
  let response = getResponse(value);
  let method = typeof request?.method === 'string' ? request.method.toUpperCase() : undefined;
  let status = getScmProviderErrorStatus(value);
  let description = getDescription(value);

  return {
    status,
    description,
    method,
    endpoint: getSanitizedEndpoint(value),
    requestId:
      getHeader(response?.headers, 'x-request-id') ??
      getHeader(response?.headers, 'x-gitlab-meta'),
    classification: classifyScmProviderError(
      status,
      description,
      typeof value?.code === 'number' ? value.code : undefined
    )
  };
};

export let isRetryableScmProviderError = (error: unknown) => {
  let classification = getScmProviderErrorDetails(error).classification;
  return ['network_failure', 'rate_limited', 'timeout', 'upstream_failure'].includes(
    classification
  );
};

let providerName = (provider: ScmProvider) =>
  provider === 'github' ? 'GitHub' : provider === 'gitlab' ? 'GitLab' : 'Bitbucket';

let formatContext = (context: Record<string, unknown> | undefined) => {
  if (!context) return undefined;

  let entries = Object.entries(context)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${key}=${sanitizeText(value, 200)}`);
  return entries.length ? entries.join(', ') : undefined;
};

export let formatScmProviderError = (d: {
  provider: ScmProvider;
  operation: string;
  error: unknown;
  context?: Record<string, unknown>;
  remediation?: string;
}) => {
  let details = getScmProviderErrorDetails(d.error);
  let parts = [
    `${providerName(d.provider)} could not ${d.operation}.`,
    details.status != null ? `HTTP status: ${details.status}.` : undefined,
    `Classified cause: ${details.classification}.`,
    details.description ? `Provider response: ${details.description}.` : undefined,
    details.method || details.endpoint
      ? `Request: ${[details.method, details.endpoint].filter(Boolean).join(' ')}.`
      : undefined,
    details.requestId ? `Provider request ID: ${details.requestId}.` : undefined,
    formatContext(d.context) ? `Context: ${formatContext(d.context)}.` : undefined,
    d.remediation ? `Remediation: ${d.remediation}` : undefined
  ];

  return parts.filter(Boolean).join(' ');
};

let publicErrorReason = (classification: ScmProviderErrorDetails['classification']) => {
  if (classification === 'protected_branch')
    return 'a protected branch rule blocked the request';
  if (classification === 'missing_branch') return 'the requested branch was not found';
  if (classification === 'permission_denied') return 'the integration lacks permission';
  if (classification === 'authentication_failed') return 'authentication failed';
  if (classification === 'resource_not_found') return 'the requested resource was not found';
  if (classification === 'conflict') return 'the resource already exists or changed';
  if (classification === 'rate_limited') return 'the provider rate limit was reached';
  if (classification === 'timeout') return 'the provider request timed out';
  if (classification === 'invalid_request') return 'the request was rejected';
  if (classification === 'upstream_failure') return 'the provider is temporarily unavailable';
  return 'the provider request failed';
};

export let formatScmProviderPublicError = (d: {
  provider: ScmProvider;
  operation: string;
  error: unknown;
}) => {
  let details = getScmProviderErrorDetails(d.error);
  return `${providerName(d.provider)} could not ${d.operation}: ${publicErrorReason(details.classification)}.`;
};

export let getScmProviderLogDetails = (error: unknown) => {
  let attached = (error as any)?.scmProviderDiagnostic;
  if (attached) return attached;
  return { providerError: getScmProviderErrorDetails(error) };
};

export let wrapScmProviderError = (
  provider: ScmProvider,
  error: unknown,
  operation: string,
  options?: {
    context?: Record<string, unknown>;
    remediation?: string;
  }
): ServiceError<any> => {
  if (isServiceError(error)) return error;

  let status = getScmProviderErrorStatus(error);
  let detailedMessage = formatScmProviderError({
    provider,
    operation,
    error,
    context: options?.context,
    remediation: options?.remediation
  });
  let message = formatScmProviderPublicError({ provider, operation, error });
  console.error(
    JSON.stringify({
      event: 'scm_provider_error',
      provider,
      operation,
      ...getScmProviderErrorDetails(error),
      context: options?.context,
      remediation: options?.remediation,
      diagnostic: detailedMessage
    })
  );
  if (status == null || status >= 500) {
    Sentry.captureException(
      error instanceof Error ? error : new Error(`SCM provider request failed (${provider})`)
    );
  }

  let mapped =
    status === 400 || status === 422
      ? badRequestError({ message })
      : status === 401
        ? unauthorizedError({ message })
        : status === 403
          ? forbiddenError({ message })
          : status === 404
            ? notFoundError({
                entity: 'SCM provider resource',
                message
              })
            : status === 409
              ? conflictError({
                  message
                })
              : status === 429
                ? tooManyRequestsError({
                    message
                  })
                : status === 408 || status === 504
                  ? timeoutError({ message })
                  : internalServerError({ message });

  let serviceError = new ServiceError(mapped);
  Object.defineProperty(serviceError, 'scmProviderDiagnostic', {
    value: {
      provider,
      operation,
      ...getScmProviderErrorDetails(error),
      context: options?.context,
      remediation: options?.remediation,
      diagnostic: detailedMessage
    },
    enumerable: false
  });
  if (error instanceof Error) serviceError.setParent(error);
  return serviceError;
};

export let withScmProviderError = async <T>(
  provider: ScmProvider,
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    throw wrapScmProviderError(provider, error, operation);
  }
};
