import { internalServerError, isServiceError, notFoundError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { Context, Env, Hono } from 'hono';

let Sentry = getSentry();

let normalizeErrorForSentry = (error: unknown) => {
  if (error instanceof Error) return error;

  let normalized = new Error(
    error === null
      ? 'Non-Error thrown: null'
      : `Non-Error thrown: ${typeof error}`
  );

  try {
    (normalized as any).cause = error;
  } catch {}

  return normalized;
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

  Sentry.captureException(normalizeErrorForSentry(error), {
    extra: {
      source: d?.source,
      request: getRequestContext(d?.c),
      thrownType: error === null ? 'null' : typeof error
    }
  });
};

export let createConnectionHono = <E extends Env>(basePath?: string) => {
  let app = new Hono<E>();
  if (basePath) app = app.basePath(basePath);

  app.use(async (c, next) => {
    await next();
    c.res.headers.set('X-Powered-By', 'Metorial');
  });

  app.notFound(c => {
    return c.json(
      {
        ...notFoundError('endpoint', null).toResponse(),
        error: 'not_found'
      },
      404
    );
  });

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
