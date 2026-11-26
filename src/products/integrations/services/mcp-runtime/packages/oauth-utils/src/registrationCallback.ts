import type { RemoteOAuthAutoRegistration } from '@mtsrc/mcp-runtime-db';
import { integrationsOAuthCallbackUrl, oauthCallbackUrl } from '@mtsrc/mcp-runtime-env';

export type AutoRegistrationCallback = Pick<
  RemoteOAuthAutoRegistration,
  'callbackUrlOverride' | 'usesIntegrationsCallback'
>;

export let getAutoRegistrationCallbackUrl = (registration: AutoRegistrationCallback) => {
  if (registration.callbackUrlOverride) return registration.callbackUrlOverride;
  if (!registration.usesIntegrationsCallback) return oauthCallbackUrl;

  if (!integrationsOAuthCallbackUrl) {
    throw new Error('INTEGRATIONS_API_URL is required for this OAuth registration');
  }
  return integrationsOAuthCallbackUrl;
};
