import { getConfig } from '@metorial/config';

export let callbackUrl = `${getConfig().urls.providerOauthUrl}/provider-oauth/callback`;
