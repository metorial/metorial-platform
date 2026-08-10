import { internalServerError, isServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';

let toErrorResponse = (error: unknown) => {
  if (isServiceError(error)) {
    return Response.json(error.toResponse(), {
      status: error.data.status
    });
  }

  return Response.json(internalServerError().toResponse(), {
    status: 500
  });
};

export let synthesisHttpApi = createHono()
  .use(async (c, next) => {
    c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    c.res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Cookies, baggage, sentry-trace'
    );
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set('Access-Control-Max-Age', '86400');

    if (c.req.method === 'OPTIONS') {
      return c.text('OK', 200);
    }

    await next();
  })
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'));
