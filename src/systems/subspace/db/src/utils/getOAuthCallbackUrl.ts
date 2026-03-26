import type { Provider, ProviderType, Tenant } from '../../prisma/generated/client';
import { env } from '../env';

export let getOAuthCallbackUrl = (
  providerType: ProviderType,
  provider: Provider,
  tenant: Tenant
) => {
  return `${env.service.PUBLIC_SERVICE_URL}/oauth-callback/${tenant.urlKey}-${provider.tag}-${providerType.shortKey}`;
};
