import { createHono } from '@mtsrc/hono';
import { parseTenantOAuthCallbackSlug } from '@metorial-subspace/db';

export let oauthCallbackApp = createHono()
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
