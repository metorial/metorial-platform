import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerAccessListingService } from '@metorial/module-consumer-access';
import { consumerSurfaceProviderGroupService } from '@metorial/module-consumer-core';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { consumerSurfaceProviderGroupPresenter } from '@metorial/presenters';
import { portalGroup } from './portal';

let consumerSurfaceProviderGroupGroup = portalGroup.use(async ctx => {
  if (!ctx.params.consumerSurfaceProviderGroupId) {
    throw new ServiceError(
      badRequestError({
        message: 'consumerSurfaceProviderGroupId is required',
        description: 'The consumerSurfaceProviderGroupId path parameter is required.'
      })
    );
  }

  let consumerSurfaceProviderGroup = await consumerSurfaceProviderGroupService.get({
    consumerSurface: ctx.portal.surface,
    consumerSurfaceProviderGroupId: ctx.params.consumerSurfaceProviderGroupId
  });

  return { consumerSurfaceProviderGroup };
});

export let portalConsumerSurfaceProviderGroupController = Controller.create(
  {
    name: 'Portal Consumer Surface Provider Groups',
    description:
      'A portal surface provider group is a named section of a portal catalog. Listings are added to groups to organize what consumers see.'
  },
  {
    list: portalGroup
      .get(
        instancePath(
          'portals/:portalId/surface-provider-groups',
          'portals.surfaceProviderGroups.list'
        ),
        {
          name: 'List portal surface provider groups',
          description: 'Returns a paginated list of surface provider groups for a portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .outputList(consumerSurfaceProviderGroupPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await consumerSurfaceProviderGroupService.list({
          consumerSurface: ctx.portal.surface
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerSurfaceProviderGroup =>
          consumerSurfaceProviderGroupPresenter.present({ consumerSurfaceProviderGroup })
        );
      }),

    get: consumerSurfaceProviderGroupGroup
      .get(
        instancePath(
          'portals/:portalId/surface-provider-groups/:consumerSurfaceProviderGroupId',
          'portals.surfaceProviderGroups.get'
        ),
        {
          name: 'Get portal surface provider group',
          description: 'Retrieves a portal surface provider group.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerSurfaceProviderGroupPresenter)
      .do(async ctx => {
        return consumerSurfaceProviderGroupPresenter.present({
          consumerSurfaceProviderGroup: ctx.consumerSurfaceProviderGroup
        });
      }),

    create: portalGroup
      .post(
        instancePath(
          'portals/:portalId/surface-provider-groups',
          'portals.surfaceProviderGroups.create'
        ),
        {
          name: 'Create portal surface provider group',
          description: 'Creates a surface provider group for a portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.string({ description: 'Display name.' }),
          description: v.optional(v.string({ description: 'Free-text description.' }))
        })
      )
      .output(consumerSurfaceProviderGroupPresenter)
      .do(async ctx => {
        let consumerSurfaceProviderGroup = await consumerSurfaceProviderGroupService.create({
          auditScope: ctx.auditScope,
          consumerSurface: ctx.portal.surface,
          input: {
            name: ctx.body.name,
            description: ctx.body.description
          }
        });

        return consumerSurfaceProviderGroupPresenter.present({ consumerSurfaceProviderGroup });
      }),

    update: consumerSurfaceProviderGroupGroup
      .patch(
        instancePath(
          'portals/:portalId/surface-provider-groups/:consumerSurfaceProviderGroupId',
          'portals.surfaceProviderGroups.update'
        ),
        {
          name: 'Update portal surface provider group',
          description:
            'Updates a surface provider group for a portal. Omitted fields keep their current value.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ description: 'Display name.' })),
          description: v.optional(v.string({ description: 'Free-text description.' })),
          index: v.optional(
            v.number({
              description: 'Order of the group in the portal catalog.',
              modifiers: [v.integer()]
            })
          )
        })
      )
      .output(consumerSurfaceProviderGroupPresenter)
      .do(async ctx => {
        let consumerSurfaceProviderGroup = await consumerSurfaceProviderGroupService.update({
          auditScope: ctx.auditScope,
          consumerSurface: ctx.portal.surface,
          consumerSurfaceProviderGroup: ctx.consumerSurfaceProviderGroup,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            index: ctx.body.index
          }
        });

        return consumerSurfaceProviderGroupPresenter.present({ consumerSurfaceProviderGroup });
      }),

    delete: consumerSurfaceProviderGroupGroup
      .delete(
        instancePath(
          'portals/:portalId/surface-provider-groups/:consumerSurfaceProviderGroupId',
          'portals.surfaceProviderGroups.delete'
        ),
        {
          name: 'Delete portal surface provider group',
          description: 'Deletes a surface provider group for a portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerSurfaceProviderGroupPresenter)
      .do(async ctx => {
        let { consumerSurfaceProviderGroup } = ctx;

        await consumerSurfaceProviderGroupService.delete({
          consumerSurfaceProviderGroup,
          consumerSurface: ctx.portal.surface,
          auditScope: ctx.auditScope
        });

        return consumerSurfaceProviderGroupPresenter.present({
          consumerSurfaceProviderGroup
        });
      }),

    addListing: consumerSurfaceProviderGroupGroup
      .post(
        instancePath(
          'portals/:portalId/surface-provider-groups/:consumerSurfaceProviderGroupId/listings',
          'portals.surfaceProviderGroups.addListing'
        ),
        {
          name: 'Add listing to surface provider group',
          description: 'Adds a consumer access listing to the surface provider group.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          consumer_access_listing_id: v.string({
            description: 'Listing to add to the group.'
          })
        })
      )
      .output(consumerSurfaceProviderGroupPresenter)
      .do(async ctx => {
        let consumerAccessListing = await consumerAccessListingService.getById({
          consumerSurface: ctx.portal.surface,
          consumerAccessListingId: ctx.body.consumer_access_listing_id
        });

        await consumerSurfaceProviderGroupService.addListing({
          auditScope: ctx.auditScope,
          consumerSurfaceProviderGroup: ctx.consumerSurfaceProviderGroup,
          consumerAccessListing
        });

        return consumerSurfaceProviderGroupPresenter.present({
          consumerSurfaceProviderGroup: ctx.consumerSurfaceProviderGroup
        });
      }),

    removeListing: consumerSurfaceProviderGroupGroup
      .delete(
        instancePath(
          'portals/:portalId/surface-provider-groups/:consumerSurfaceProviderGroupId/listings/:consumerAccessListingId',
          'portals.surfaceProviderGroups.removeListing'
        ),
        {
          name: 'Remove listing from surface provider group',
          description: 'Removes a consumer access listing from the surface provider group.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:write'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerSurfaceProviderGroupPresenter)
      .do(async ctx => {
        if (!ctx.params.consumerAccessListingId) {
          throw new ServiceError(
            badRequestError({
              message: 'consumerAccessListingId is required',
              description: 'The consumerAccessListingId path parameter is required.'
            })
          );
        }

        let consumerAccessListing = await consumerAccessListingService.getById({
          consumerSurface: ctx.portal.surface,
          consumerAccessListingId: ctx.params.consumerAccessListingId
        });

        await consumerSurfaceProviderGroupService.removeListing({
          auditScope: ctx.auditScope,
          consumerSurfaceProviderGroup: ctx.consumerSurfaceProviderGroup,
          consumerAccessListing
        });

        return consumerSurfaceProviderGroupPresenter.present({
          consumerSurfaceProviderGroup: ctx.consumerSurfaceProviderGroup
        });
      })
  }
);
