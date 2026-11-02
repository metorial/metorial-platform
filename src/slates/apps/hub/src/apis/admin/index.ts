import { apiMux } from '@lowerdeck/api-mux';
import { createStaticAssetResponse } from '@lowerdeck/hono';
import { resolve, sep } from 'node:path';
import { slatesHubAdminApi } from './controllers';

let adminDir = resolve('./dist/admin');

let frontendHandler = async (req: Request) => {
  let url = new URL(req.url);
  let path = url.pathname || '/index.html';
  if (path === '/') path = '/index.html';

  let targetPath = resolve(adminDir, `.${path}`);
  if (!targetPath.startsWith(`${adminDir}${sep}`)) {
    return new Response('Not Found', { status: 404 });
  }

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

export let adminApi = apiMux([{ endpoint: slatesHubAdminApi }], frontendHandler);
