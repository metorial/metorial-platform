import { internalServerError, isServiceError, notFoundError } from '@lowerdeck/error';
import { Env, Hono } from 'hono';

export let createOAuthHono = <E extends Env>(basePath?: string) => {
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

    console.error(e);

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
