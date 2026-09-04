import { forbiddenError, ServiceError } from '@lowerdeck/error';
import type { ProviderAuthMethod, Tenant } from '@metorial-subspace/db';

type AuthMethodPolicyCarrier = Pick<ProviderAuthMethod, 'type'> | null | undefined;

export let isAuthMethodAllowedForTenant = (
  tenant: Pick<Tenant, 'onlyAllowOAuthAuthMethods'>,
  authMethod: AuthMethodPolicyCarrier,
  requiresAuth = false
) =>
  !tenant.onlyAllowOAuthAuthMethods ||
  (!requiresAuth && !authMethod) ||
  authMethod?.type === 'oauth';

export let assertAuthMethodAllowedForTenant = (d: {
  tenant: Pick<Tenant, 'onlyAllowOAuthAuthMethods'>;
  authMethod: AuthMethodPolicyCarrier;
  requiresAuth?: boolean;
}) => {
  if (isAuthMethodAllowedForTenant(d.tenant, d.authMethod, d.requiresAuth)) return;

  throw new ServiceError(
    forbiddenError({
      message: 'This project only allows OAuth authentication methods',
      code: 'non_oauth_auth_method_not_allowed'
    })
  );
};
