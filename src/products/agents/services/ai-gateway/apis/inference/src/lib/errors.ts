import { isServiceError } from '@lowerdeck/error';

export type Dialect = 'openai_chat' | 'anthropic_messages' | 'open_responses';

export type GatewayError = { status: number; code: string; message: string; param?: string };

let openaiType = (status: number) => {
  if (status == 401) return 'authentication_error';
  if (status == 403) return 'permission_error';
  if (status == 404) return 'not_found_error';
  if (status == 429) return 'rate_limit_error';
  if (status >= 500) return 'api_error';

  return 'invalid_request_error';
};

let anthropicType = (status: number) => {
  if (status == 401) return 'authentication_error';
  if (status == 403) return 'permission_error';
  if (status == 404) return 'not_found_error';
  if (status == 413) return 'request_too_large';
  if (status == 429) return 'rate_limit_error';
  if (status == 529) return 'overloaded_error';
  if (status >= 500) return 'api_error';

  return 'invalid_request_error';
};

// Each dialect's SDK parses its own error envelope (the Anthropic SDK reads `error.type`, the
// OpenAI SDK `error.code` and `error.param`), so errors are shaped per dialect, never shared.
export let dialectErrorBody = (dialect: Dialect, error: GatewayError) => {
  if (dialect == 'anthropic_messages') {
    return {
      type: 'error',
      error: { type: anthropicType(error.status), message: error.message }
    };
  }

  return {
    error: {
      message: error.message,
      type: openaiType(error.status),
      param: error.param ?? null,
      code: error.code
    }
  };
};

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

export let errorResponse = (
  dialect: Dialect,
  error: GatewayError,
  headers: Record<string, string> = {}
) =>
  Response.json(dialectErrorBody(dialect, error), {
    status: error.status,
    headers: error.status == 401 ? { 'WWW-Authenticate': 'Bearer', ...headers } : headers
  });
