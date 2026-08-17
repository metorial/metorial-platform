import { v } from '@lowerdeck/validation';
import { getPortalAllowedRedirectUrlFilters } from '@metorial/consumer-oauth-utils';
import { portalService } from '@metorial/module-portal';
import { Presenter } from '@metorial/presenter';
import { portalType } from '../../types';

export let v1PortalPresenter = Presenter.create(portalType)
  .presenter(async ({ portal, portalUrl, namespaces }) => ({
    object: 'portal' as const,
    id: portal.id,
    status: portal.status,
    name: portal.name,
    slug: portal.slug,
    description: portal.description,
    allow_consumer_skill_authoring: portal.surface.allowConsumerSkillAuthoring,
    allow_consumer_skill_publishing: portal.surface.allowConsumerSkillPublishing,
    skill_configuration: {
      object: 'portal.skill_configuration' as const,
      id: portal.surface.skillConfiguration.id,
      is_default: portal.surface.skillConfiguration.isDefault,
      allow_scripts: portal.surface.skillConfiguration.allowScripts,
      allowed_file_extensions: portal.surface.skillConfiguration.allowedFileExtensions,
      allow_non_standard_directories:
        portal.surface.skillConfiguration.allowNonStandardDirectories
    },
    auth: {
      object: 'portal.auth' as const,
      session_expiry_time_in_seconds: portal.surface.sessionExpiryTimeInSeconds,
      allowed_redirect_url_filters: getPortalAllowedRedirectUrlFilters(
        portal.allowedRedirectUrlFilters
      )
    },
    urls: namespaces
      ? await portalService.getPortalUrls({ portal, namespaces })
      : ([{ type: 'default' as const, url: portalUrl }] as any),
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
      allow_consumer_skill_authoring: v.boolean(),
      allow_consumer_skill_publishing: v.boolean(),
      skill_configuration: v.object({
        object: v.literal('portal.skill_configuration'),
        id: v.string(),
        is_default: v.boolean(),
        allow_scripts: v.boolean(),
        allowed_file_extensions: v.array(v.string()),
        allow_non_standard_directories: v.boolean()
      }),
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
          type: v.enumOf(['default', 'namespace']),
          url: v.string()
        })
      ),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
