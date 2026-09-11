import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerAccessListingService } from '@metorial/module-consumer-access';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { consumerAccessListingPresenter } from '@metorial/presenters';
import { portalGroup } from './portal';

let consumerAccessListingGroup = portalGroup.use(async ctx => {
  if (!ctx.params.listingId) {
    throw new ServiceError(
      badRequestError({
        message: 'listingId is required',
        description: 'The listingId path parameter is required.'
      })
    );
  }

  let consumerAccessListing = await consumerAccessListingService.getById({
    consumerSurface: ctx.portal.surface,
    consumerAccessListingId: ctx.params.listingId
  });

  return { consumerAccessListing };
});

export let portalConsumerAccessListingController = Controller.create(
  {
    name: 'Portal Listings',
    description: 'Read the shared listings available on a portal surface.'
  },
  {
    list: portalGroup
      .get(instancePath('portals/:portalId/listings', 'portals.listings.list'), {
        name: 'List portal listings',
        description: 'Returns a paginated list of shared listings for a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .outputList(consumerAccessListingPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            consumer_surface_provider_group_id: v.optional(
              v.union([v.string(), v.array(v.string())])
            ),
            provider_template_id: v.optional(v.union([v.string(), v.array(v.string())])),
            magic_mcp_server_id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_template_id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_group_id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_marketplace_id: v.optional(v.union([v.string(), v.array(v.string())])),
            type: v.optional(
              v.union([
                v.enumOf([
                  'provider_template',
                  'magic_mcp_server',
                  'skill',
                  'skill_template',
                  'skill_group',
                  'skill_marketplace'
                ]),
                v.array(
                  v.enumOf([
                    'provider_template',
                    'magic_mcp_server',
                    'skill',
                    'skill_template',
                    'skill_group',
                    'skill_marketplace'
                  ])
                )
              ])
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await consumerAccessListingService.list({
          consumerSurface: ctx.portal.surface,
          consumerSurfaceProviderGroupIds: normalizeArrayParam(
            ctx.query.consumer_surface_provider_group_id
          ),
          providerTemplateIds: normalizeArrayParam(ctx.query.provider_template_id),
          magicMcpServerIds: normalizeArrayParam(ctx.query.magic_mcp_server_id),
          skillIds: normalizeArrayParam(ctx.query.skill_id),
          skillTemplateIds: normalizeArrayParam(ctx.query.skill_template_id),
          skillGroupIds: normalizeArrayParam(ctx.query.skill_group_id),
          skillMarketplaceIds: normalizeArrayParam(ctx.query.skill_marketplace_id),
          types: normalizeArrayParam(ctx.query.type),
          search: ctx.query.search
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerAccessListing =>
          consumerAccessListingPresenter.present({ consumerAccessListing })
        );
      }),

    get: consumerAccessListingGroup
      .get(instancePath('portals/:portalId/listings/:listingId', 'portals.listings.get'), {
        name: 'Get portal listing',
        description: 'Retrieves one shared listing for a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerAccessListingPresenter)
      .do(async ctx => {
        return consumerAccessListingPresenter.present({
          consumerAccessListing: ctx.consumerAccessListing
        });
      }),

    create: portalGroup
      .post(instancePath('portals/:portalId/listings', 'portals.listings.create'), {
        name: 'Create portal listing',
        description: 'Creates a shared listing for a portal.'
      })
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          readme: v.optional(v.nullable(v.string())),
          access: v.union([
            v.object({
              type: v.literal('provider_template'),
              provider_template_id: v.string()
            }),
            v.object({
              type: v.literal('magic_mcp_server'),
              magic_mcp_server_id: v.string()
            }),
            v.object({
              type: v.literal('skill'),
              skill_id: v.string()
            }),
            v.object({
              type: v.literal('skill_template'),
              skill_template_id: v.string()
            }),
            v.object({
              type: v.literal('skill_group'),
              skill_group_id: v.string()
            }),
            v.object({
              type: v.literal('skill_marketplace'),
              skill_marketplace_id: v.string()
            })
          ])
        })
      )
      .output(consumerAccessListingPresenter)
      .do(async ctx => {
        let access = ctx.body.access;
        let consumerAccessListing = await consumerAccessListingService.create({
          consumerSurface: ctx.portal.surface,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            readme: ctx.body.readme,
            access:
              access.type == 'provider_template'
                ? {
                    type: 'provider_template',
                    providerTemplateId: access.provider_template_id
                  }
                : access.type == 'magic_mcp_server'
                  ? {
                      type: 'magic_mcp_server',
                      magicMcpServerId: access.magic_mcp_server_id
                    }
                  : access.type == 'skill'
                    ? {
                        type: 'skill',
                        skillId: access.skill_id
                      }
                    : access.type == 'skill_template'
                      ? {
                          type: 'skill_template',
                          skillTemplateId: access.skill_template_id
                        }
                      : access.type == 'skill_group'
                        ? {
                            type: 'skill_group',
                            skillGroupId: access.skill_group_id
                          }
                        : {
                            type: 'skill_marketplace',
                            skillMarketplaceId: access.skill_marketplace_id
                          }
          }
        });

        return consumerAccessListingPresenter.present({ consumerAccessListing });
      }),

    update: consumerAccessListingGroup
      .patch(
        instancePath('portals/:portalId/listings/:listingId', 'portals.listings.update'),
        {
          name: 'Update portal listing',
          description: 'Updates listing metadata for a portal listing.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          readme: v.optional(v.nullable(v.string()))
        })
      )
      .output(consumerAccessListingPresenter)
      .do(async ctx => {
        let consumerAccessListing = await consumerAccessListingService.update({
          consumerAccessListing: ctx.consumerAccessListing,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            readme: ctx.body.readme
          }
        });

        return consumerAccessListingPresenter.present({ consumerAccessListing });
      }),

    delete: consumerAccessListingGroup
      .delete(
        instancePath('portals/:portalId/listings/:listingId', 'portals.listings.delete'),
        {
          name: 'Delete portal listing',
          description: 'Deletes a portal listing and all consumer access attached to it.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerAccessListingPresenter)
      .do(async ctx => {
        let consumerAccessListing = await consumerAccessListingService.delete({
          organization: ctx.organization,
          consumerAccessListing: ctx.consumerAccessListing,
          auditScope: ctx.auditScope
        });

        return consumerAccessListingPresenter.present({ consumerAccessListing });
      })
  }
);
