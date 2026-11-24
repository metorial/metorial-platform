export type DecisionErrorCode =
  'timeout' | 'unreachable' | 'rate_limited' | 'rejected' | 'invalid_response' | 'unavailable';

export class DecisionError extends Error {
  constructor(
    readonly code: DecisionErrorCode,
    message: string,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = 'DecisionError';
  }
}

export let isDecisionError = (error: unknown): error is DecisionError =>
  error instanceof DecisionError;
