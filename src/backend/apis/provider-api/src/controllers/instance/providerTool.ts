import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderToolService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { toolPresenter } from '../../presenters';
import { SubspaceTool } from '../../presenters/types';

export let providerToolGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerToolId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerToolId is required',
        description: 'The providerToolId path parameter is required.'
      })
    );
  }

  let tool = await subspaceProviderToolService.get({
    instance: ctx.instance,
    providerToolId: ctx.params.providerToolId
  });

  return { tool };
});

export let providerToolController = Controller.create(
  {
    name: 'Provider Tools',
    description: 'Browse tools available in providers.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-tools', 'providerTools.list'), {
        name: 'List provider tools',
        description: 'Returns a paginated list of provider tools.'
      })
      .outputList(toolPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            provider_specification_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderToolService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerSpecificationId: ctx.query.provider_specification_id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, tool =>
          toolPresenter.present({ tool: tool as SubspaceTool })
        );
      }),

    get: providerToolGroup
      .get(providerPath('provider-tools/:providerToolId', 'providerTools.get'), {
        name: 'Get provider tool',
        description: 'Retrieves a specific provider tool by ID.'
      })
      .output(toolPresenter)
      .do(async ctx => {
        return toolPresenter.present({ tool: ctx.tool });
      })
  }
);
