import { isServiceError } from '@lowerdeck/error';
import {
  EGRESS_POLICY_BLOCKED_CODE,
  getEgressPolicyErrorMessage,
  isEgressPolicyError
} from '../../lib/network/egressPolicy';

export interface ConnectionErrorPayload {
  code: string;
  message: string;
}

export class ConnectionError extends Error {
  constructor(readonly payload: ConnectionErrorPayload) {
    super(`Connection error (${payload.code}): ${payload.message}`);
    this.name = 'ConnectionError';
  }

  get code() {
    return this.payload.code;
  }
}

export class HttpResponseError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: string
  ) {
    super(`Error response ${status} ${statusText}`);
    this.name = 'HttpResponseError';
  }
}

let statusToCode = (status: number) => {
  if (status === 401 || status === 403) return 'authentication_failed';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'connection_error';
  return 'http_error';
};

/**
 * Every failure that reaches a connection listener goes through here so that
 * Subspace always receives a definite, classifiable error instead of silence.
 */
export let toConnectionError = (
  error: unknown,
  fallbackCode = 'connection_error'
): ConnectionErrorPayload => {
  if (error instanceof ConnectionError) return error.payload;

  if (isEgressPolicyError(error)) {
    return {
      code: EGRESS_POLICY_BLOCKED_CODE,
      message: getEgressPolicyErrorMessage(error)
    };
  }

  if (error instanceof HttpResponseError) {
    return {
      code: statusToCode(error.status),
      message: `The MCP server responded with HTTP ${error.status} ${error.statusText}`.trim()
    };
  }

  if (isServiceError(error)) {
    return { code: error.data.code, message: error.data.message };
  }

  let code = (error as { code?: unknown } | null)?.code;
  let message = (error as { message?: unknown } | null)?.message;

  return {
    code: typeof code === 'string' ? code : fallbackCode,
    message: typeof message === 'string' && message ? message : 'Unknown connection error'
  };
};
