import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderListingGroupService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerGroupPresenter } from '../../presenters';

export let providerGroupGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerGroupId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerGroupId is required',
        description: 'The providerGroupId path parameter is required.'
      })
    );
  }

  let group = await subspaceProviderListingGroupService.get({
    instance: ctx.instance,
    providerListingGroupId: ctx.params.providerGroupId
  });

  return { group };
});

export let providerGroupController = Controller.create(
  {
    name: 'Provider Groups',
    description:
      "A group is a user-defined custom folder for organizing providers in your instance like 'Sales Tools' or 'Engineering'."
  },
  {
    list: instanceGroup
      .get(instancePath('provider-groups', 'providerGroups.list'), {
        name: 'List provider groups',
        description: 'Returns a paginated list of provider groups.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(providerGroupPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await subspaceProviderListingGroupService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, group => providerGroupPresenter.present({ group }));
      }),

    get: providerGroupGroup
      .get(instancePath('provider-groups/:providerGroupId', 'providerGroups.get'), {
        name: 'Get provider group',
        description: 'Retrieves a specific provider group by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(providerGroupPresenter)
      .do(async ctx => {
        return providerGroupPresenter.present({ group: ctx.group });
      }),

    create: instanceGroup
      .post(instancePath('provider-groups', 'providerGroups.create'), {
        name: 'Create provider group',
        description: 'Creates a new custom provider group.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ examples: ['Sales Integrations'] }),
          description: v.optional(
            v.string({ examples: ['CRM and sales pipeline integrations'] })
          )
        })
      )
      .output(providerGroupPresenter)
      .do(async ctx => {
        let group = await subspaceProviderListingGroupService.create({
          instance: ctx.instance,
          name: ctx.body.name,
          description: ctx.body.description
        });

        return providerGroupPresenter.present({
          group
        });
      }),

    update: providerGroupGroup
      .patch(instancePath('provider-groups/:providerGroupId', 'providerGroups.update'), {
        name: 'Update provider group',
        description: 'Updates an existing provider group.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Engineering Tools'] })),
          description: v.optional(
            v.string({ examples: ['Developer and DevOps integrations'] })
          )
        })
      )
      .output(providerGroupPresenter)
      .do(async ctx => {
        let group = await subspaceProviderListingGroupService.update({
          instance: ctx.instance,
          providerListingGroupId: ctx.group.id,
          name: ctx.body.name,
          description: ctx.body.description
        });

        return providerGroupPresenter.present({
          group
        });
      }),

    addListing: providerGroupGroup
      .post(
        instancePath('provider-groups/:providerGroupId/listings', 'providerGroups.addListing'),
        {
          name: 'Add listing to group',
          description: 'Adds a provider listing to a group.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .body(
        'default',
        v.object({
          provider_listing_id: v.string({ examples: ['plg_abc123'] })
        })
      )
      .output(providerGroupPresenter)
      .do(async ctx => {
        await subspaceProviderListingGroupService.addProvider({
          instance: ctx.instance,
          providerListingGroupId: ctx.group.id,
          providerListingId: ctx.body.provider_listing_id
        });

        return providerGroupPresenter.present({ group: ctx.group });
      }),

    removeListing: providerGroupGroup
      .delete(
        instancePath(
          'provider-groups/:providerGroupId/listings/:providerListingId',
          'providerGroups.removeListing'
        ),
        {
          name: 'Remove listing from group',
          description: 'Removes a provider listing from a group.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .output(providerGroupPresenter)
      .do(async ctx => {
        if (!ctx.params.providerListingId) {
          throw new ServiceError(
            badRequestError({
              message: 'providerListingId is required',
              description: 'The providerListingId path parameter is required.'
            })
          );
        }

        await subspaceProviderListingGroupService.removeProvider({
          instance: ctx.instance,
          providerListingGroupId: ctx.group.id,
          providerListingId: ctx.params.providerListingId
        });

        return providerGroupPresenter.present({ group: ctx.group });
      })
  }
);
