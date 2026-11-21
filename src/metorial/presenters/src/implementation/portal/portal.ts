import { v } from '@lowerdeck/validation';
import { getPortalAllowedRedirectUrlFilters } from '@metorial/consumer-oauth-utils';
import { portalService } from '@metorial/module-portal';
import { Presenter } from '@metorial/presenter';
import { portalType } from '../../types';
import { getCachedPortalConnectUrl } from '../provider/magicMcp/portalConnectUrl';

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
    magic_mcp_url: await getCachedPortalConnectUrl(portal),
    created_at: portal.createdAt,
    updated_at: portal.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('portal', { description: 'String representing the object’s type.' }),
      id: v.string({ description: 'Unique ID.', examples: ['ptl_7hNkPqRsTuVwXyZa'] }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: '`archived` once you delete the portal.'
      }),
      name: v.string({ description: 'Display name.' }),
      slug: v.string({
        description: 'URL-safe name, unique across Metorial.',
        examples: ['acme-portal']
      }),
      description: v.nullable(v.string({ description: 'Free-text description.' })),
      allow_consumer_skill_authoring: v.boolean({
        description: 'Whether consumers can create skills on the portal.'
      }),
      allow_consumer_skill_publishing: v.boolean({
        description: 'Whether consumers can publish skills on the portal.'
      }),
      skill_configuration: v.object(
        {
          object: v.literal('portal.skill_configuration', {
            description: 'String representing the object’s type.'
          }),
          id: v.string({ description: 'Unique ID.' }),
          is_default: v.boolean({
            description: 'Whether the portal uses the default skill settings.'
          }),
          allow_scripts: v.boolean({
            description: 'Whether skills on the portal can run scripts.'
          }),
          allowed_file_extensions: v.array(v.string(), {
            description: 'File extensions skills on the portal can use.'
          }),
          allow_non_standard_directories: v.boolean({
            description: 'Whether skills can use directories outside the standard layout.'
          })
        },
        { description: 'Skill settings for the portal.' }
      ),
      auth: v.object(
        {
          object: v.literal('portal.auth', {
            description: 'String representing the object’s type.'
          }),
          session_expiry_time_in_seconds: v.number({
            description: 'How long consumer sessions stay valid, in seconds.'
          }),
          allowed_redirect_url_filters: v.array(
            v.object({
              url: v.string({
                description: 'A redirect URL pattern consumers may return to after signing in.'
              })
            }),
            { description: 'Redirect URL patterns consumers may return to after signing in.' }
          )
        },
        { description: 'Consumer authentication settings for the portal.' }
      ),
      urls: v.array(
        v.object({
          type: v.enumOf(['default', 'namespace'], {
            description: '`namespace` for namespace-specific URLs, `default` otherwise.'
          }),
          url: v.string({ description: 'Where consumers open the portal.' })
        }),
        { description: 'Addresses consumers open the portal at.' }
      ),
      magic_mcp_url: v.string({
        description: 'The MCP connection URL for the portal.',
        examples: ['https://api.metorial.com/connect/portal/acme-portal']
      }),
      created_at: v.date({ description: 'Creation time.' }),
      updated_at: v.date({ description: 'Last update time.' })
    })
  )
  .build();

export let dashboardPortalPresenter = Presenter.create(portalType)
  .presenter(async ({ portal, portalUrl, namespaces }, opts) => {
    let inner = await v1PortalPresenter
      .present({ portal, portalUrl, namespaces }, opts)
      .run({});

    return {
      ...inner,

      managed_everyone_group_id: portal.surface.managedEveryoneGroup?.id ?? null
    };
  })
  .schema(
    v.intersection([
      v1PortalPresenter.schema,
      v.object({
        managed_everyone_group_id: v.nullable(
          v.string({ description: 'The default group every consumer on the portal belongs to.' })
        )
      })
    ])
  )
  .build();
