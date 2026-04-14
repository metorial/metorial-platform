import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import path, { join } from 'path';
import { env } from '../../../env';
import { htmlEncode } from '../../../lib/htmlEncode';
import { registerPublicFiles } from '../../../lib/publicFiles';
import { tickets } from '../../../lib/tickets';
import { userService } from '../../../services/user';

let assetsDir = path.join(process.cwd(), 'frontend', 'auth', 'dist', 'assets');

let cachedIndexHtmlText: string | null = null;

let indexHtml = Bun.file(join(process.cwd(), 'frontend', 'auth', 'dist', 'index.html'));

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

let app = createHono();
registerPublicFiles(app);

export let publicApp = app
  .get('/ping', c => c.text('OK'))
  .get('/metorial-ares/assets/:key*', async c => {
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
  .get('/logout/:ticket', async ctx => {
    let ticket = await tickets.decode(
      ctx.req.param('ticket'),
      v.object({
        type: v.literal('logout'),
        deviceId: v.string(),
        sessionId: v.string()
      })
    );

    return ctx.redirect('https://metorial.com/');
  })
  .get('/verify-email', async ctx => {
    let key = ctx.req.query('key');
    if (!key) {
      throw new ServiceError(
        badRequestError({
          message: 'Key is required'
        })
      );
    }

    let res = await userService.verifyUserEmail({
      key
    });

    return ctx.redirect(`${env.service.ARES_AUTH_URL}/email-verified?email=${res.email}`);
  })
  .get('*', async c => {
    let preload = {};

    return c.html(
      (await getIndexHtmlText()).replace(
        '<!-- PRELOAD -->',
        `<script type="application/json" id="preload-data">${htmlEncode(JSON.stringify(preload))}</script>`
      )
    );
  });
