import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { portalAuthSsoConnectionType } from '../../types';

export let v1PortalAuthSsoConnectionPresenter = Presenter.create(portalAuthSsoConnectionType)
  .presenter(async ({ ssoConnection }) => ({
    object: 'portal.auth.sso_connection' as const,
    id: ssoConnection.id,
    name: ssoConnection.name,
    provider_type: ssoConnection.providerType,
    provider_name: ssoConnection.providerName,
    created_at: ssoConnection.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('portal.auth.sso_connection'),
      id: v.string(),
      name: v.string(),
      provider_type: v.enumOf(['saml', 'oidc']),
      provider_name: v.nullable(v.string()),
      created_at: v.date()
    })
  )
  .build();
