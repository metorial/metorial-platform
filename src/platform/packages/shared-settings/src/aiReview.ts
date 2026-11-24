import { v } from '@lowerdeck/validation';
import { defineSettings, setting } from '@metorial/settings';
import { once } from './once';

export let getAiReviewProviderConfig = once(() => {
  let settings = defineSettings('models', {
    cloudflareApiToken: setting(v.optional(v.string()), { env: 'CLOUDFLARE_AI_API_TOKEN' }),
    cloudflareAccountId: setting(v.optional(v.string()), { env: 'CLOUDFLARE_ACCOUNT_ID' }),
    gatewayApiKey: setting(v.optional(v.string()), { env: 'AI_GATEWAY_API_KEY' })
  });

  let apiToken = settings.cloudflareApiToken?.trim();
  let accountId = settings.cloudflareAccountId?.trim();
  let apiKey = settings.gatewayApiKey?.trim();

  if (!!apiToken !== !!accountId) {
    console.warn(
      'Security reviews: CLOUDFLARE_AI_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must both be set to use Cloudflare'
    );
  }

  return {
    cloudflare: apiToken && accountId ? { apiToken, accountId } : undefined,
    vercel: apiKey ? { apiKey } : undefined
  };
});

export let isAiReviewConfigured = () => {
  let { cloudflare, vercel } = getAiReviewProviderConfig();
  return !!(cloudflare || vercel);
};
