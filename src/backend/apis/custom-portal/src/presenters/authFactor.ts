import { ConsumerSurfaceAuthFactor, SsoTenant } from '@metorial/db';

export let authFactorPresenter = (
  code: ConsumerSurfaceAuthFactor & { ssoTenant: SsoTenant | null }
) => ({
  object: 'portal#auth_factor',

  id: code.id,

  type: code.type,
  name: code.publicName,

  ssoTenantId: code.ssoTenant?.id || null,

  createdAt: code.createdAt,
  updatedAt: code.updatedAt
});
