import { badRequestError, internalServerError, isServiceError } from '@mtsrc/error';
import { createHono } from '@mtsrc/hono';
import { join } from 'path';
import { htmlEncode } from '../../lib/htmlEncode';
import { getFullSession } from '../internal/setupSession';

let preloadMarker = '<!-- PRELOAD -->';
let textEncoder = new TextEncoder();
let cachedIndexHtmlTemplate: { beforePreload: string; afterPreload: string } | null = null;

let indexHtmlPath = join(process.cwd(), 'frontend', 'dist', 'index.html');
let indexHtml = Bun.file(indexHtmlPath);

if (!(await indexHtml.exists())) {
  throw new Error('Index HTML file not found. Make sure the frontend is built.');
}

let indexHtmlContents = await indexHtml.text();

let parseIndexHtmlTemplate = (indexHtmlText: string) => {
  let markerIndex = indexHtmlText.indexOf(preloadMarker);
  if (markerIndex === -1) {
    throw new Error('Index HTML preload marker not found.');
  }

  return {
    beforePreload: indexHtmlText.slice(0, markerIndex),
    afterPreload: indexHtmlText.slice(markerIndex + preloadMarker.length)
  };
};

let getIndexHtmlTemplate = async () => {
  if (process.env.NODE_ENV === 'production' && cachedIndexHtmlTemplate) {
    return cachedIndexHtmlTemplate;
  }

  if (process.env.NODE_ENV !== 'production') {
    // In development, always read from disk to pick up changes without restarting the server.
    let indexHtmlFile = Bun.file(indexHtmlPath);
    indexHtmlContents = await indexHtmlFile.text();
  }

  let template = parseIndexHtmlTemplate(indexHtmlContents);

  if (process.env.NODE_ENV === 'production') {
    cachedIndexHtmlTemplate = template;
  }

  return template;
};

export let renderIndexHtml = async (preload: unknown) => {
  let template = await getIndexHtmlTemplate();
  let preloadScript = `<script type="application/json" id="preload-data">${htmlEncode(
    JSON.stringify(preload)
  )}</script>`;

  return new Response(
    new ReadableStream({
      start(controller: any) {
        controller.enqueue(textEncoder.encode(template.beforePreload));
        controller.enqueue(textEncoder.encode(preloadScript));
        controller.enqueue(textEncoder.encode(template.afterPreload));
        controller.close();
      }
    }),
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    }
  );
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

    return await renderIndexHtml(preload);
  });
