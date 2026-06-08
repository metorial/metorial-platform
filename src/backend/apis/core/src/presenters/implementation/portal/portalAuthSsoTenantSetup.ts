import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { portalAuthSsoTenantSetupType } from '../../types';

export let v1PortalAuthSsoTenantSetupPresenter = Presenter.create(portalAuthSsoTenantSetupType)
  .presenter(async ({ ssoTenantSetup }) => ({
    object: 'portal.auth.sso_tenant_setup' as const,
    url: ssoTenantSetup.setupUrl
  }))
  .schema(
    v.object({
      object: v.literal('portal.auth.sso_tenant_setup'),
      url: v.string()
    })
  )
  .build();
