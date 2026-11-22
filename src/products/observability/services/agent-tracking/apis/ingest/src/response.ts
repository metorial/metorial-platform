import { isServiceError, internalServerError, type ErrorRecord } from '@lowerdeck/error';
import {
  getStore,
  isStoreConfigured,
  isTransientStoreError,
  sinkBusyError,
  sinkBusyRetryAfterSeconds
} from '@mtsrc/agent-tracking-store';

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

  if (isTransientStoreError(error)) {
    if (isStoreConfigured()) getStore().logUnreachable(error);

    return retryLaterResponse(sinkBusyError(), sinkBusyRetryAfterSeconds);
  }

  console.error(error);

  return errorResponse(internalServerError());
};
