import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { ssoTenantType } from '../types';

export let v1SsoTenantPresenter = Presenter.create(ssoTenantType)
  .presenter(async ({ ssoTenant }, opts) => ({
    object: 'sso.tenant',

    id: ssoTenant.id,

    sso_tenant_id: ssoTenant.ssoTenantId,
    sso_tenant_client_id: ssoTenant.ssoTenantClientId,

    created_at: ssoTenant.createdAt,
    updated_at: ssoTenant.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('sso.tenant', {
        name: 'object',
        description: 'Type of the object, fixed as sso.tenant'
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the sso tenant'
      }),

      sso_tenant_id: v.string({
        name: 'sso_tenant_id',
        description: 'The SSO Tenant ID provided by the SSO provider'
      }),

      sso_tenant_client_id: v.string({
        name: 'sso_tenant_client_id',
        description: 'The SSO Tenant Client ID provided by the SSO provider'
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
