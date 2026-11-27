export type NormalizedProviderErrorCode =
  | 'provider_unreachable'
  | 'provider_connect_timeout'
  | 'provider_request_timeout'
  | 'provider_auth_failed'
  | 'provider_auth_expired'
  | 'provider_protocol_error'
  | 'provider_closed'
  | 'provider_overloaded'
  | 'egress_policy_blocked'
  | 'provider_error';

export interface NormalizedProviderError {
  code: NormalizedProviderErrorCode;
  message: string;
  detail?: string;
}

let MESSAGES: Record<NormalizedProviderErrorCode, string> = {
  provider_unreachable:
    'The MCP server could not be reached. It may be offline, or its URL or command may be misconfigured.',
  provider_connect_timeout:
    'The MCP server did not accept a connection in time. It may be offline, overloaded, or slow to start.',
  provider_request_timeout: 'The MCP server did not respond to the request in time.',
  provider_auth_failed:
    'The MCP server rejected the configured credentials. The connection needs to be re-authenticated.',
  provider_auth_expired:
    'The credentials for this MCP server have expired and could not be refreshed. The connection needs to be re-authenticated.',
  provider_protocol_error:
    'The MCP server returned a response that does not conform to the Model Context Protocol.',
  provider_closed: 'The connection to the MCP server was closed before the request completed.',
  provider_overloaded:
    'The MCP server is currently rejecting requests because it is overloaded.',
  egress_policy_blocked:
    'The connection to the MCP server was blocked by the configured network egress policy.',
  provider_error: 'The MCP server reported an error.'
};

let CODE_ALIASES: Record<string, NormalizedProviderErrorCode> = {
  egress_policy_blocked: 'egress_policy_blocked',

  auth_token_refresh_failed: 'provider_auth_expired',
  authentication_expired: 'provider_auth_expired',
  oauth_token_refresh_failed: 'provider_auth_expired',
  token_refresh_failed: 'provider_auth_expired',

  authentication_required: 'provider_auth_failed',
  authentication_failed: 'provider_auth_failed',
  invalid_credentials: 'provider_auth_failed',
  unauthorized: 'provider_auth_failed',
  forbidden: 'provider_auth_failed',

  timeout: 'provider_request_timeout',
  timeout_error: 'provider_request_timeout',
  request_timeout: 'provider_request_timeout',
  provider_request_timeout: 'provider_request_timeout',

  connect_timeout: 'provider_connect_timeout',
  provider_connect_timeout: 'provider_connect_timeout',
  initialization_timeout: 'provider_connect_timeout',

  connection_error: 'provider_unreachable',
  connection_failed: 'provider_unreachable',
  initialize_failed: 'provider_unreachable',
  http_error: 'provider_unreachable',
  econnrefused: 'provider_unreachable',
  enotfound: 'provider_unreachable',
  etimedout: 'provider_connect_timeout',

  closed: 'provider_closed',
  connection_closed: 'provider_closed',

  overloaded: 'provider_overloaded',
  rate_limited: 'provider_overloaded',

  protocol_error: 'provider_protocol_error',
  invalid_response: 'provider_protocol_error'
};

let MAX_DETAIL_LENGTH = 400;

let SECRET_ASSIGNMENT_PATTERN =
  /\b(authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|private[_-]?key|password|passwd|secret|token|cookie|session[_-]?id)\b\s*[:=]?\s*["']?[A-Za-z0-9._~+/=-]{4,}["']?/gi;
let URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)\]]+/gi;
let LONG_OPAQUE_PATTERN = /\b[A-Za-z0-9._~+/=-]{32,}\b/g;

export let redactSensitiveText = (input: string): string =>
  input
    .replace(SECRET_ASSIGNMENT_PATTERN, match => `${match.split(/[\s:=]/)[0]} [redacted]`)
    .replace(URL_PATTERN, '[redacted url]')
    .replace(LONG_OPAQUE_PATTERN, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DETAIL_LENGTH);

let httpStatusToCode = (status: number): NormalizedProviderErrorCode | null => {
  if (status === 401) return 'provider_auth_failed';
  if (status === 403) return 'provider_auth_failed';
  if (status === 408) return 'provider_request_timeout';
  if (status === 429) return 'provider_overloaded';
  if (status === 502 || status === 503 || status === 504) return 'provider_unreachable';
  return null;
};

let resolveCode = (raw: unknown): NormalizedProviderErrorCode | null => {
  if (typeof raw === 'number') {
    return httpStatusToCode(raw);
  }

  if (typeof raw !== 'string') return null;

  let normalized = raw.trim().toLowerCase();
  if (normalized in CODE_ALIASES) return CODE_ALIASES[normalized]!;

  let numeric = Number(normalized);
  if (Number.isInteger(numeric)) return httpStatusToCode(numeric);

  return null;
};

let codeFromMessage = (message: string): NormalizedProviderErrorCode | null => {
  let normalized = message.toLowerCase();

  if (/timed? ?out|timeout/.test(normalized)) return 'provider_request_timeout';
  if (/egress/.test(normalized)) return 'egress_policy_blocked';
  if (/refresh (the )?(access )?token|token (has )?expired/.test(normalized)) {
    return 'provider_auth_expired';
  }
  if (/unauthorized|forbidden|invalid[_ ]credentials|authentication/.test(normalized)) {
    return 'provider_auth_failed';
  }
  if (
    /econnrefused|enotfound|network|unreachable|socket hang up|fetch failed/.test(normalized)
  ) {
    return 'provider_unreachable';
  }
  if (/closed|disconnect/.test(normalized)) return 'provider_closed';

  return null;
};

let extractRaw = (
  error: unknown
): { code: unknown; message: string | null; status?: unknown } => {
  if (error === null || error === undefined) return { code: null, message: null };

  if (typeof error === 'string') return { code: null, message: error };

  if (error instanceof Error) {
    return { code: (error as any).code ?? null, message: error.message };
  }

  if (typeof error === 'object') {
    let candidate = error as Record<string, any>;

    // Unwrap `{ error: { code, message } }` envelopes used by the backends.
    if (candidate.error && typeof candidate.error === 'object') {
      let inner = extractRaw(candidate.error);
      return {
        code: inner.code ?? candidate.code ?? null,
        message: inner.message,
        status: inner.status ?? candidate.status
      };
    }

    return {
      code: candidate.code ?? null,
      message: typeof candidate.message === 'string' ? candidate.message : null,
      status: candidate.status ?? candidate.statusCode
    };
  }

  return { code: null, message: null };
};

export let normalizeProviderError = (
  error: unknown,
  fallback: NormalizedProviderErrorCode = 'provider_error'
): NormalizedProviderError => {
  let raw = extractRaw(error);

  let code =
    resolveCode(raw.code) ??
    resolveCode(raw.status) ??
    (raw.message ? codeFromMessage(raw.message) : null) ??
    fallback;

  let detail = raw.message ? redactSensitiveText(raw.message) : '';

  return {
    code,
    message: MESSAGES[code],
    detail: detail || undefined
  };
};

export let providerErrorToOutput = (error: NormalizedProviderError) => ({
  type: 'error' as const,
  error: {
    code: error.code,
    message: error.detail ? `${error.message} (${error.detail})` : error.message
  }
});
