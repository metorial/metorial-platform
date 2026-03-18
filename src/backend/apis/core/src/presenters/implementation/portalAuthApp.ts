import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { portalAuthAppType } from '../types';

export let v1PortalAuthAppPresenter = Presenter.create(portalAuthAppType)
  .presenter(async ({ app }) => ({
    object: 'portal.auth.app' as const,
    id: app.id,
    client_id: app.clientId,
    slug: app.slug ?? null,
    default_redirect_url: app.defaultRedirectUrl,
    redirect_domains: app.redirectDomains,
    created_at: app.createdAt,
    updated_at: app.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('portal.auth.app'),
      id: v.string({ description: 'The Ares app identifier for this portal.' }),
      client_id: v.string({ description: 'The Ares app client identifier.' }),
      slug: v.nullable(v.string({ description: 'The Ares app slug.' })),
      default_redirect_url: v.string({
        description: 'The default redirect URL configured for this portal auth app.',
        modifiers: [v.url()]
      }),
      redirect_domains: v.array(
        v.string({
          description: 'A hostname or wildcard hostname allowed for redirect callbacks.'
        })
      ),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
