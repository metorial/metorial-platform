import { internalServerError, isServiceError, notFoundError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { Context, createHono } from '@lowerdeck/hono';
import type { Env } from 'hono';

let Sentry = getSentry();

let normalizeErrorForSentry = (error: unknown) => {
  if (error instanceof Error) return error;

  let normalized = new Error(
    error === null ? 'Non-Error thrown: null' : `Non-Error thrown: ${typeof error}`
  );

  try {
    (normalized as any).cause = error;
  } catch {}

  return normalized;
};

let getErrorCandidates = (error: unknown): unknown[] => {
  let candidates = [error];
  let cause =
    error && typeof error == 'object' && 'cause' in error ? (error as { cause?: unknown }).cause : null;

  if (cause !== undefined && cause !== null && cause !== error) {
    candidates.push(cause);
  }

  return candidates;
};

let isExpectedConnectionAbortError = (error: unknown) => {
  return getErrorCandidates(error).some(candidate => {
    if (!candidate || typeof candidate != 'object') return false;

    let name = 'name' in candidate ? (candidate as { name?: unknown }).name : undefined;
    let message = 'message' in candidate ? (candidate as { message?: unknown }).message : undefined;

    return (
      name === 'AbortError' &&
      (message === 'The connection was closed.' || message === 'This operation was aborted')
    );
  });
};

let getRequestContext = (c?: Context) => {
  if (!c) return undefined;

  let url = new URL(c.req.url);
  return {
    method: c.req.method,
    path: url.pathname
  };
};

export let reportConnectionError = (
  error: unknown,
  d?: {
    c?: Context;
    source?: string;
  }
) => {
  if (isServiceError(error) && error.data.status < 500) return;
  if (isExpectedConnectionAbortError(error)) return;

  Sentry.captureException(normalizeErrorForSentry(error), {
    extra: {
      source: d?.source,
      request: getRequestContext(d?.c),
      thrownType: error === null ? 'null' : typeof error
    }
  });
};

export let createConnectionHono = <E extends Env>(basePath?: string) => {
  let app = createHono<E>(basePath);

  app.onError((e, c) => {
    if (isServiceError(e)) {
      reportConnectionError(e, { c, source: 'connection_hono' });

      let res = e.toResponse();
      if (res.oauth) {
        return c.json(
          {
            error: res.oauth.error,
            error_message: res.oauth.errorMessage
          },
          { status: e.data.status as any }
        );
      }

      return c.json({ ...res, error: res.code }, e.data.status);
    }

    if (process.env.NODE_ENV != 'production') console.error(e);
    reportConnectionError(e, { c, source: 'connection_hono' });

    return c.json(
      {
        ...internalServerError().toResponse(),
        error: 'internal_server_error'
      },
      500
    );
  });

  return app;
};
