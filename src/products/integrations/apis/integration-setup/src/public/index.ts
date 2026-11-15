import { createHono } from '@lowerdeck/hono';
import { integrationsCors } from '../corsMiddleware';
import { integrationSetupSessionApp } from './integrationSetupSession';
import { oauthCallbackApp } from './oauthCallback';
import { oauthSetupApp } from './oauthSetup';
import { setupSessionApp } from './setupSession';
import { toolCallArtifactApp } from './toolCallArtifact';

export let integrationsPublicApi = createHono()
  .use('*', integrationsCors)
  .options('*', () => new Response(null, { status: 204 }))
  .get('/ping', c => c.text('OK'))
  .route('/tool-call-attachments', toolCallArtifactApp)
  .route('/tool-call-artifacts', toolCallArtifactApp)
  .route('/oauth-setup', oauthSetupApp)
  .route('/setup-session', setupSessionApp)
  .route('/integration-setup-session', integrationSetupSessionApp)
  .route('/oauth-callback', oauthCallbackApp);
