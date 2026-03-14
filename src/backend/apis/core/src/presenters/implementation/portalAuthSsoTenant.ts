import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { portalAuthSsoTenantType } from '../types';

export let v1PortalAuthSsoTenantPresenter = Presenter.create(portalAuthSsoTenantType)
  .presenter(async ({ ssoTenant }) => ({
    object: 'portal.auth.sso_tenant' as const,
    id: ssoTenant.id,
    name: ssoTenant.name,
    status: ssoTenant.status,
    client_id: ssoTenant.clientId,
    external_id: ssoTenant.externalId,
    is_global: ssoTenant.isGlobal,
    counts: {
      connections: ssoTenant.counts.connections
    },
    created_at: ssoTenant.createdAt,
    updated_at: ssoTenant.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('portal.auth.sso_tenant'),
      id: v.string(),
      name: v.string(),
      status: v.enumOf(['pending', 'completed']),
      client_id: v.string(),
      external_id: v.nullable(v.string()),
      is_global: v.boolean(),
      counts: v.object({
        connections: v.number()
      }),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
