import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { portalService } from '@metorial/module-portal';
import { namespaceService } from '@metorial/module-organization';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { portalPresenter } from '@metorial/presenters';

let portalAllowedRedirectUrlFilterValidator = v.object({
  url: v.string()
});

let presentPortal = async (portal: Parameters<typeof portalPresenter.present>[0]['portal']) => {
  let namespacesByPortalOid = await namespaceService.getNamespacePropertiesByPortalOid({
    portals: [portal]
  });

  return portalPresenter.present({
    portal,
    portalUrl: (await portalService.getPortalHost({ portal })).host,
    namespaces: namespacesByPortalOid.get(portal.oid) ?? []
  });
};

let skillConfigurationValidator = v.object({
  allow_scripts: v.optional(v.boolean()),
  allowed_file_extensions: v.optional(v.nullable(v.array(v.string()))),
  allow_non_standard_directories: v.optional(v.boolean())
});

export let portalGroup = instanceGroup
  .use(requireConsumerTokenForPublishableKey())
  .use(async ctx => {
    if (!ctx.params.portalId) {
      throw new Error('portalId is required');
    }

    let portal = await portalService.getPortalById({
      portalId: ctx.params.portalId,
      instance: ctx.instance
    });

    if (ctx.portal && ctx.portal.id !== portal.id) {
      throw new ServiceError(notFoundError('portal'));
    }

    return { portal };
  });

export let portalController = Controller.create(
  {
    name: 'Portal',
    description:
      'Use Portals to create custom branded MCP server marketplaces for your organization.'
  },
  {
    list: instanceGroup
      .get(instancePath('portals', 'portals.list'), {
        name: 'List portals',
        description: 'Returns a paginated list of portals.'
      })
      .use(requireConsumerTokenForPublishableKey())
      .use(checkAccess({ possibleScopes: ['instance.portal:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .outputList(portalPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string({ description: 'Search by name or description' }))
          })
        )
      )
      .do(async ctx => {
        let paginator = await portalService.listPortals({
          instance: ctx.instance,
          search: ctx.query.search
        });
        let list = await paginator.run(ctx.query);

        let portalUrls = Object.fromEntries(
          await Promise.all(
            list.items.map(async portal => [
              portal.id,
              (await portalService.getPortalHost({ portal })).host
            ])
          )
        );
        let namespacesByPortalOid = await namespaceService.getNamespacePropertiesByPortalOid({
          portals: list.items
        });

        return Paginator.present(list, portal =>
          portalPresenter.present({
            portal,
            portalUrl: portalUrls[portal.id],
            namespaces: namespacesByPortalOid.get(portal.oid) ?? []
          })
        );
      }),

    get: portalGroup
      .get(instancePath('portals/:portalId', 'portals.get'), {
        name: 'Get portal',
        description: 'Retrieves details for a specific portal.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.portal:read', 'consumer#instance.portal:read']
        })
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(portalPresenter)
      .do(async ctx => presentPortal(ctx.portal)),

    create: instanceGroup
      .post(instancePath('portals', 'portals.create'), {
        name: 'Create portal',
        description: 'Creates a new portal for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          allowed_redirect_url_filters: v.optional(
            v.array(portalAllowedRedirectUrlFilterValidator)
          ),
          session_expiry_time_in_seconds: v.optional(
            v.number({
              modifiers: [v.minValue(600), v.maxValue(60 * 60 * 24 * 30 * 2)]
            })
          ),
          allow_consumer_skill_authoring: v.optional(v.boolean()),
          allow_consumer_skill_publishing: v.optional(v.boolean())
        })
      )
      .output(portalPresenter)
      .do(async ctx => {
        let portal = await portalService.createPortal({
          organization: ctx.organization,
          instance: ctx.instance,
          context: ctx.context,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            allowedRedirectUrlFilters: ctx.body.allowed_redirect_url_filters,
            sessionExpiryTimeInSeconds: ctx.body.session_expiry_time_in_seconds,
            allowConsumerSkillAuthoring: ctx.body.allow_consumer_skill_authoring,
            allowConsumerSkillPublishing: ctx.body.allow_consumer_skill_publishing
          }
        });

        return presentPortal(portal);
      }),

    update: portalGroup
      .patch(instancePath('portals/:portalId', 'portals.update'), {
        name: 'Update portal',
        description: 'Updates an existing portal for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          allowed_redirect_url_filters: v.optional(
            v.array(portalAllowedRedirectUrlFilterValidator)
          ),
          session_expiry_time_in_seconds: v.optional(
            v.number({
              modifiers: [v.minValue(600), v.maxValue(60 * 60 * 24 * 30 * 2)]
            })
          ),
          allow_consumer_skill_authoring: v.optional(v.boolean()),
          allow_consumer_skill_publishing: v.optional(v.boolean()),
          skill_configuration: v.optional(skillConfigurationValidator)
        })
      )
      .output(portalPresenter)
      .do(async ctx => {
        let portal = await portalService.updatePortal({
          portal: ctx.portal,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            allowedRedirectUrlFilters: ctx.body.allowed_redirect_url_filters,
            sessionExpiryTimeInSeconds: ctx.body.session_expiry_time_in_seconds,
            allowConsumerSkillAuthoring: ctx.body.allow_consumer_skill_authoring,
            allowConsumerSkillPublishing: ctx.body.allow_consumer_skill_publishing,
            skillConfiguration: ctx.body.skill_configuration
              ? {
                  allowScripts: ctx.body.skill_configuration.allow_scripts,
                  allowedFileExtensions: ctx.body.skill_configuration.allowed_file_extensions,
                  allowNonStandardDirectories:
                    ctx.body.skill_configuration.allow_non_standard_directories
                }
              : undefined
          }
        });

        return presentPortal(portal);
      }),

    delete: portalGroup
      .delete(instancePath('portals/:portalId', 'portals.delete'), {
        name: 'Delete portal',
        description: 'Archives a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(portalPresenter)
      .do(async ctx => {
        let portal = await portalService.archivePortal({
          portal: ctx.portal
        });

        return presentPortal(portal);
      })
  }
);
