import { apiMux } from '@lowerdeck/api-mux';
import { createStaticAssetResponse } from '@lowerdeck/hono';
import { slatesHubAdminApi } from '@mtsrc/slates-hub-api-admin';

import { env } from '@mtsrc/slates-hub-env/env';

let adminDir = './dist/admin';

let frontendHandler = async (req: Request) => {
  let url = new URL(req.url);
  let path = url.pathname || '/index.html';
  if (path === '/') path = '/index.html';

  if (path.includes('..')) {
    return new Response('Not Found', { status: 404 });
  }

  let targetPath = `${adminDir}${path}`;
  let file = Bun.file(targetPath);
  if (await file.exists()) {
    if (path.startsWith('/assets/')) {
      return createStaticAssetResponse(req, targetPath, {
        contentType: file.type || 'application/octet-stream'
      });
    }

    return new Response(file, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (!path.includes('.')) {
    let index = Bun.file(`${adminDir}/index.html`);
    if (await index.exists()) {
      return new Response(index, { headers: { 'Cache-Control': 'no-store' } });
    }
  }

  return new Response('Not Found', { status: 404 });
};

let adminApi = apiMux([{ endpoint: slatesHubAdminApi }], frontendHandler);

Bun.serve({
  fetch: adminApi,
  port: env.service.SLATES_HUB_ADMIN_PORT ?? 52047
});
