import { v } from '@lowerdeck/validation';
import { getOrganizationBrand } from '@metorial/db';
import { getPortalAllowedRedirectUrlFilters } from '@metorial/module-portal';
import { Presenter } from '@metorial/presenter';
import { portalType } from '../types';

export let v1PortalPresenter = Presenter.create(portalType)
  .presenter(async ({ portal, portalUrl }) => ({
    object: 'portal' as const,
    id: portal.id,
    status: portal.status,
    name: portal.name,
    slug: portal.slug,
    description: portal.description,
    auth: {
      object: 'portal.auth' as const,
      session_expiry_time_in_seconds: portal.surface.sessionExpiryTimeInSeconds,
      allowed_redirect_url_filters: getPortalAllowedRedirectUrlFilters(
        portal.allowedRedirectUrlFilters
      )
    },
    urls: [
      {
        type: 'default' as const,
        url: portalUrl
      }
    ],
    brand: await getOrganizationBrand(portal.organization),
    created_at: portal.createdAt,
    updated_at: portal.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('portal'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      slug: v.string(),
      description: v.nullable(v.string()),
      auth: v.object({
        object: v.literal('portal.auth'),
        session_expiry_time_in_seconds: v.number(),
        allowed_redirect_url_filters: v.array(
          v.object({
            url: v.string()
          })
        )
      }),
      urls: v.array(
        v.object({
          type: v.enumOf(['default']),
          url: v.string()
        })
      ),
      brand: v.object({
        image: v.string(),
        name: v.string()
      }),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
