import { internalServerError, isServiceError, notFoundError } from '@metorial/error';
import { Context, Env, Hono } from 'hono';
import { cors } from 'hono/cors';

export { cors, type Context };

export let createHono = <E extends Env>(basePath?: string) => {
  let app = new Hono<E>();
  if (basePath) app = app.basePath(basePath);

  app.notFound(c => {
    return c.json(notFoundError('endpoint').toResponse(), 404);
  });

  app.onError((e, c) => {
    if (isServiceError(e)) {
      return c.json(e.toResponse(), e.data.status);
    }

    console.error(e);
    return c.json(internalServerError().toResponse(), 500);
  });

  return app;
};
