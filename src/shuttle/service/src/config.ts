import { env } from './env';

export let oauthCallbackUrl = `${env.service.PROVIDER_OAUTH_URL}/shuttle-oauth/callback`;
