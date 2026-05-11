import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerAccessListingService } from '@metorial/module-consumer';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { consumerAccessListingPresenter } from '../../../presenters';
import { portalGroup } from './portal';

let consumerAccessListingGroup = portalGroup.use(async ctx => {
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

  return { consumerAccessListing };
});

export let portalConsumerAccessListingController = Controller.create(
  {
    name: 'Portal Consumer Access Listings',
    description: 'Read the shared consumer access listings available on a portal surface.'
  },
  {
    list: portalGroup
      .get(
        instancePath(
          'portals/:portalId/consumer-access-listings',
          'portals.consumerAccessListings.list'
        ),
        {
          name: 'List portal consumer access listings',
          description:
            'Returns a paginated list of shared consumer access listings for a portal.'
        }
      )
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
            type: v.optional(
              v.union([
                v.enumOf(['provider_template', 'magic_mcp_server']),
                v.array(v.enumOf(['provider_template', 'magic_mcp_server']))
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
          types: normalizeArrayParam(ctx.query.type),
          search: ctx.query.search
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, consumerAccessListing =>
          consumerAccessListingPresenter.present({ consumerAccessListing })
        );
      }),

    get: consumerAccessListingGroup
      .get(
        instancePath(
          'portals/:portalId/consumer-access-listings/:consumerAccessListingId',
          'portals.consumerAccessListings.get'
        ),
        {
          name: 'Get portal consumer access listing',
          description: 'Retrieves one shared consumer access listing for a portal.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.portal.access:read'] }))
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerAccessListingPresenter)
      .do(async ctx => {
        return consumerAccessListingPresenter.present({
          consumerAccessListing: ctx.consumerAccessListing
        });
      })
  }
);
