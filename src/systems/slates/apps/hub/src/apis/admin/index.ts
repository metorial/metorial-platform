import { apiMux } from '@mtsrc/api-mux';
import { slatesHubAdminApi } from './controllers';

let adminDir = './dist/admin';

let frontendHandler = async (req: Request) => {
  let url = new URL(req.url);
  let path = url.pathname || '/index.html';
  if (path === '/') path = '/index.html';

  let file = Bun.file(`${adminDir}${path}`);
  if (await file.exists()) return new Response(file);

  if (!path.includes('.')) {
    let index = Bun.file(`${adminDir}/index.html`);
    if (await index.exists()) return new Response(index);
  }

  return new Response('Not Found', { status: 404 });
};

export let adminApi = apiMux([{ endpoint: slatesHubAdminApi }], frontendHandler);
