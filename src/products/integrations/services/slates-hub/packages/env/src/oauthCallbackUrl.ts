import { env } from './env';

let callbackUrlBase = new URL(env.service.SERVICE_PUBLIC_URL);
callbackUrlBase.pathname = '/slates-hub/callback';

export let oauthCallbackUrl = callbackUrlBase.toString();
