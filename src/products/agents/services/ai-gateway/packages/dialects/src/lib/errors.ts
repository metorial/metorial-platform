import type { Dialect } from './types';

export type GatewayError = {
  status: number;
  code: string;
  message: string;
  param?: string;
};

export class DialectRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly param?: string
  ) {
    super(message);
  }

  toGatewayError(): GatewayError {
    return { status: 400, code: this.code, message: this.message, param: this.param };
  }
}

export let isDialectRequestError = (error: unknown): error is DialectRequestError =>
  error instanceof DialectRequestError;

export let invalidParam = (param: string, message: string) =>
  new DialectRequestError('invalid_request', message, param);

export let unsupportedParam = (param: string, message: string) =>
  new DialectRequestError('unsupported_parameter', message, param);

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
