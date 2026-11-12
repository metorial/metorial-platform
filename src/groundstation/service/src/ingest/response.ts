import { isServiceError, internalServerError, type ErrorRecord } from '@lowerdeck/error';
import { sinkBusyRetryAfterSeconds } from '../sink/types';

export let jsonResponse = (status: number, body: unknown, headers?: Record<string, string>) =>
  Response.json(body, { status, headers });

export let errorResponse = (
  error: ErrorRecord<any, any>,
  headers?: Record<string, string>
): Response => jsonResponse(error.data.status, error.toResponse(), headers);

export let retryLaterResponse = (
  error: ErrorRecord<any, any>,
  retryAfterSeconds: number
): Response => errorResponse(error, { 'Retry-After': String(retryAfterSeconds) });

export let caughtErrorResponse = (error: unknown): Response => {
  if (isServiceError(error)) {
    let headers =
      error.data.code == 'sink_busy'
        ? { 'Retry-After': String(sinkBusyRetryAfterSeconds) }
        : undefined;

    return jsonResponse(error.data.status, error.toResponse(), headers);
  }

  console.error(error);

  return errorResponse(internalServerError());
};
