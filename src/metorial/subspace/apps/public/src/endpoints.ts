import { createHono } from '@lowerdeck/hono';
import { join, resolve, sep } from 'path';
import { env } from './env';

let frontendDist = join(process.cwd(), 'frontend', 'dist');
let assetsDir = join(frontendDist, 'assets');
let indexHtmlPath = join(frontendDist, 'index.html');
let cachedIndexHtml: string | null = null;

let serveAsset = async (key: string) => {
  let targetPath = resolve(assetsDir, key);
  if (!targetPath.startsWith(`${resolve(assetsDir)}${sep}`)) {
    return new Response('Forbidden', { status: 403 });
  }

  let file = Bun.file(targetPath);
  if (!(await file.exists())) return new Response('Not Found', { status: 404 });

  return new Response(file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(file.size)
    }
  });
};

let renderIndexHtml = async () => {
  if (process.env.NODE_ENV !== 'production' || !cachedIndexHtml) {
    let template = await Bun.file(indexHtmlPath).text();
    let runtimeConfig = JSON.stringify({
      integrationsApiUrl: env.service.INTEGRATIONS_API_URL
    }).replace(/</g, '\\u003c');
    cachedIndexHtml = template.replace(
      '<!-- RUNTIME_CONFIG -->',
      `<script type="application/json" id="runtime-config">${runtimeConfig}</script>`
    );
  }

  return new Response(cachedIndexHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
};

export let app = createHono()
  .get('/ping', c => c.text('OK'))
  .get('/assets/:key*', async c => await serveAsset(c.req.param('key*')))
  .get('/subspace-public/assets/:key*', async c => await serveAsset(c.req.param('key*')))
  .get('/setup-session/:sessionId', async () => await renderIndexHtml())
  .get('/integration-setup-session/:sessionId', async () => await renderIndexHtml());

let server = Bun.serve({
  fetch: app.fetch,
  port: Number(process.env.PORT ?? 52071)
});

console.log(`Integration UI running on http://localhost:${server.port}`);
