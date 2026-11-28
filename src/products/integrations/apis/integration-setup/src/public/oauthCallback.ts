import { createHono } from '@lowerdeck/hono';
import { parseTenantOAuthCallbackSlug } from '@metorial-subspace/db';
import { env } from '../env';

export let oauthCallbackApp = createHono()
  .get('/mcp', c => {
    let shuttleUrl = env.service.SHUTTLE_PUBLIC_URL;
    if (!shuttleUrl) return c.text('Shuttle callback is unavailable', 503);

    let destination = new URL('/shuttle-oauth/callback', shuttleUrl);
    destination.search = new URL(c.req.url).search;
    c.header('Cache-Control', 'no-store');
    return c.redirect(destination.toString(), 302);
  })
  .get('/:oauthIdentifier', async c => {
    let oauthIdentifier = c.req.param('oauthIdentifier');
    let parsed = await parseTenantOAuthCallbackSlug(oauthIdentifier);
    if (!parsed) return c.text('Invalid oauth callback URL', 400);

    let { tenant, provider, providerType: type } = parsed;
    if (
      type.attributes.auth.status === 'disabled' ||
      type.attributes.auth.oauth.status === 'disabled'
    ) {
      return c.text('OAuth is disabled for this provider', 400);
    }

    let currentUrl = new URL(c.req.url);

    let destUrl = new URL(type.attributes.auth.oauth.oauthCallbackUrl);
    destUrl.search = currentUrl.search;

    destUrl.searchParams.set('source', 'metorial_subspace');
    destUrl.searchParams.set('subspace_tenant_id', tenant.id);
    destUrl.searchParams.set('subspace_provider_id', provider.id);
    if (tenant.slateTenantId)
      destUrl.searchParams.set('slates_tenant_id', tenant.slateTenantId);
    if (tenant.shuttleTenantId)
      destUrl.searchParams.set('shuttle_tenant_id', tenant.shuttleTenantId);

    return c.redirect(destUrl.toString());
  });
