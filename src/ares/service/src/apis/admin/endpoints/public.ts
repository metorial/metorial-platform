import { createHono } from '@lowerdeck/hono';
import path, { join } from 'path';
import { env } from '../../../env';
import { adminAppClientId } from '../../../lib/adminApp';
import { registerPublicFiles } from '../../../lib/publicFiles';

let assetsDir = path.join(process.cwd(), 'frontend', 'admin', 'dist', 'assets');

let cachedIndexHtmlText: string | null = null;

let indexHtml = Bun.file(join(process.cwd(), 'frontend', 'admin', 'dist', 'index.html'));

if (!(await indexHtml.exists())) {
  throw new Error('Admin index HTML file not found. Make sure the admin frontend is built.');
}

let getIndexHtmlText = async () => {
  if (process.env.NODE_ENV === 'production' && cachedIndexHtmlText) {
    return cachedIndexHtmlText;
  }

  cachedIndexHtmlText = await indexHtml.text();
  return cachedIndexHtmlText;
};

let app = createHono();
registerPublicFiles(app);

export let publicApp = app
  .get('/ping', c => c.text('OK'))
  .get('/metorial-ares-admin/assets/:key*', async c => {
    let key = c.req.param('key*');

    let targetPath = path.resolve(assetsDir, key);
    if (!targetPath.startsWith(assetsDir)) return c.text('Forbidden', 403);

    let bunFile = Bun.file(targetPath);
    if (!(await bunFile.exists())) return c.text('Not Found', 404);

    return c.body(await bunFile.arrayBuffer(), {
      headers: {
        'Content-Type': bunFile.type || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  })
  .get('*', async c => {
    let preload = {
      adminAppClientId,
      authUrl: env.service.ARES_AUTH_URL,
      adminUrl: env.service.ARES_ADMIN_URL
    };

    return c.html(
      (await getIndexHtmlText()).replace(
        '<!-- PRELOAD -->',
        `<script type="application/json" id="preload-data">${JSON.stringify(preload)}</script>`
      )
    );
  });
