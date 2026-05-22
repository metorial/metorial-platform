import path from 'path';
import { integrationSetupSessionApp } from './integrationSetupSession';
import { oauthCallbackApp } from './oauthCallback';
import { oauthSetupApp } from './oauthSetup';
import { pingApp } from './pingApp';
import { setupSessionApp } from './setupSession';
import { toolCallArtifactApp } from './toolCallArtifact';

let assetsDir = path.join(process.cwd(), 'frontend', 'dist', 'assets');
let assetCacheControl = 'public, max-age=31536000, immutable';

let serveAsset = async (key: string) => {
  let targetPath = path.resolve(assetsDir, key);
  if (!targetPath.startsWith(assetsDir)) return new Response('Forbidden', { status: 403 });

  let bunFile = Bun.file(targetPath);
  if (!(await bunFile.exists())) return new Response('Not Found', { status: 404 });

  // Return the file directly so Bun can serve it without materializing the whole asset in JS memory.
  return new Response(bunFile, {
    headers: {
      'Content-Type': bunFile.type || 'application/octet-stream',
      'Cache-Control': assetCacheControl,
      'Content-Length': String(bunFile.size)
    }
  });
};

export let app = pingApp
  .route('/tool-call-attachments', toolCallArtifactApp)
  .route('/tool-call-artifacts', toolCallArtifactApp)
  .get('/subspace-public/assets/:key*', async c => {
    let key = c.req.param('key*');
    return await serveAsset(key);
  })
  .route('/oauth-setup', oauthSetupApp)
  .route('/setup-session', setupSessionApp)
  .route('/integration-setup-session', integrationSetupSessionApp)
  .route('/oauth-callback', oauthCallbackApp)
  .get('/assets/:key*', async c => {
    let key = c.req.param('key*');
    return await serveAsset(key);
  });
