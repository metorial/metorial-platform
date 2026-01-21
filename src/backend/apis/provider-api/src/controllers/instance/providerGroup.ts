import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderListingGroupService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { groupPresenter } from '../../presenters';
import { SubspaceGroup } from '../../presenters/types';

export let providerGroupGroup = providerInstanceGroup.use(async ctx => {
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
    description: 'Browse and manage provider groups in the catalog.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-groups', 'providerGroups.list'), {
        name: 'List provider groups',
        description: 'Returns a paginated list of provider groups.'
      })
      .outputList(groupPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await subspaceProviderListingGroupService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, group =>
          groupPresenter.present({ group: group as SubspaceGroup })
        );
      }),

    get: providerGroupGroup
      .get(providerPath('provider-groups/:providerGroupId', 'providerGroups.get'), {
        name: 'Get provider group',
        description: 'Retrieves a specific provider group by ID.'
      })
      .output(groupPresenter)
      .do(async ctx => {
        return groupPresenter.present({ group: ctx.group });
      }),

    create: providerInstanceGroup
      .post(providerPath('provider-groups', 'providerGroups.create'), {
        name: 'Create provider group',
        description: 'Creates a new custom provider group.'
      })
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          slug: v.string(),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(groupPresenter)
      .do(async ctx => {
        let group = await subspaceProviderListingGroupService.create({
          instance: ctx.instance,
          name: ctx.body.name,
          description: ctx.body.description,
          slug: ctx.body.slug,
          metadata: ctx.body.metadata
        });

        return groupPresenter.present({ group: group as SubspaceGroup });
      }),

    update: providerGroupGroup
      .patch(providerPath('provider-groups/:providerGroupId', 'providerGroups.update'), {
        name: 'Update provider group',
        description: 'Updates an existing provider group.'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          slug: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(groupPresenter)
      .do(async ctx => {
        let group = await subspaceProviderListingGroupService.update({
          instance: ctx.instance,
          providerListingGroupId: ctx.group.id,
          name: ctx.body.name,
          description: ctx.body.description,
          slug: ctx.body.slug,
          metadata: ctx.body.metadata
        });

        return groupPresenter.present({ group: group as SubspaceGroup });
      })
  }
);
