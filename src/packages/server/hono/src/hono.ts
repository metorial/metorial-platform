import { internalServerError, isServiceError, notFoundError } from '@metorial/error';
import { getSentry } from '@metorial/sentry';
import { Context, Env, Hono } from 'hono';
import { cors } from 'hono/cors';

export { cors, type Context };

export let createHono = <E extends Env>(basePath?: string) => {
  let app = new Hono<E>();
  if (basePath) app = app.basePath(basePath);

  let Sentry = getSentry();

  app.notFound(c => {
    return c.json(notFoundError('endpoint', null).toResponse(), 404);
  });

  app.onError((e, c) => {
    if (isServiceError(e)) {
      return c.json(e.toResponse(), e.data.status);
    }

    Sentry.captureException(e, {
      extra: {
        method: c.req.method,
        url: c.req.url
      }
    });

    console.error(e);
    return c.json(internalServerError().toResponse(), 500);
  });

  return app;
};
