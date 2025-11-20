import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { ssoTenantSetupType } from '../types';

export let v1SsoTenantSetupPresenter = Presenter.create(ssoTenantSetupType)
  .presenter(async ({ ssoTenantSetup }, opts) => ({
    object: 'sso.tenant',

    id: ssoTenantSetup.id,

    sso_tenant_id: ssoTenantSetup.tenantId,
    sso_connection_id: ssoTenantSetup.connectionId,

    url: ssoTenantSetup.url,
    redirect_uri: ssoTenantSetup.redirectUri,

    created_at: ssoTenantSetup.createdAt,
    updated_at: ssoTenantSetup.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('sso.tenant.setup', {
        name: 'object',
        description: 'Type of the object, fixed as sso.tenant.setup'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the sso tenant'
      }),

      sso_tenant_id: v.string({
        name: 'sso_tenant_id',
        description: 'The SSO Tenant ID provided by the SSO provider'
      }),

      sso_connection_id: v.string({
        name: 'sso_connection_id',
        description: 'The SSO Connection ID associated with this setup'
      }),

      url: v.string({
        name: 'url',
        description: 'The URL to initiate the SSO authentication process'
      }),

      redirect_uri: v.string({
        name: 'redirect_uri',
        description: 'The redirect URI configured for the SSO tenant setup'
      }),

      created_at: v.date({
        name: 'created_at',
        description: 'The ISO 8601 timestamp when the sso tenant was created'
      }),

      updated_at: v.date({
        name: 'updated_at',
        description: 'The ISO 8601 timestamp when the sso tenant was last updated'
      })
    })
  )
  .build();
