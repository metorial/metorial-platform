import { badRequestError, internalServerError, isServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { join } from 'path';
import { htmlEncode } from '../../lib/htmlEncode';
import { getFullSession } from '../internal/setupSession';

let cachedIndexHtmlText: string | null = null;

let indexHtml = Bun.file(join(process.cwd(), 'frontend', 'dist', 'index.html'));

if (!(await indexHtml.exists())) {
  throw new Error('Index HTML file not found. Make sure the frontend is built.');
}

let getIndexHtmlText = async () => {
  if (process.env.NODE_ENV === 'production' && cachedIndexHtmlText) {
    return cachedIndexHtmlText;
  }

  cachedIndexHtmlText = await indexHtml.text();
  return cachedIndexHtmlText;
};

export let setupSessionApp = createHono()
  .use(async (c, next) => {
    await next();

    c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
    c.res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
  })
  .get('/:sessionId/:key*?', async c => {
    let sessionId = c.req.param('sessionId');
    let clientSecret = c.req.query('client_secret');

    let preload = {};

    if (!clientSecret) {
      preload = {
        type: 'error',
        error: badRequestError({ message: 'Invalid Setup Session URL' }).toResponse()
      };
    } else {
      try {
        preload = {
          type: 'data',
          data: await getFullSession({ sessionId, clientSecret }),
          input: { sessionId, clientSecret }
        };
      } catch (e) {
        if (isServiceError(e)) {
          preload = {
            type: 'error',
            error: e.toResponse()
          };
        } else {
          preload = {
            type: 'error',
            error: internalServerError().toResponse()
          };
        }
      }
    }

    return c.html(
      (await getIndexHtmlText()).replace(
        '<!-- PRELOAD -->',
        `<script type="application/json" id="preload-data">${htmlEncode(JSON.stringify(preload))}</script>`
      )
    );
  });
