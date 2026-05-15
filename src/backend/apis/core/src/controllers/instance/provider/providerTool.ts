import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceProviderToolService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerToolPresenter } from '../../../presenters';

let providerToolGroup = instanceGroup.use(async ctx => {
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
    description:
      "A tool is a single action a provider can perform like 'search_issues' or 'send_message'. Tools are what AI agents call via MCP. By default, tools from the latest provider version are returned. Use the optional version filter to get tools for a specific version."
  },
  {
    list: instanceGroup
      .get(instancePath('providers-tools', 'providers.tools.list'), {
        name: 'List provider tools',
        description:
          'Returns a paginated list of provider tools. By default returns tools from the latest version. Use optional filters to get tools for a specific version.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.specification:read'] }))
      .outputList(providerToolPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_version_id: v.string()
          })
        )
      )
      .do(async ctx => {
        let listInput = {
          instance: ctx.instance,
          // Compatibility: some subspace controller-client builds validate this field
          // as `providerVersion` instead of `providerVersionId`.
          providerVersionId: ctx.query.provider_version_id,
          providerVersion: ctx.query.provider_version_id
        };

        let paginator = await subspaceProviderToolService.list(listInput);

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, tool => providerToolPresenter.present({ tool }));
      }),

    get: providerToolGroup
      .get(instancePath('providers-tools/:providerToolId', 'providers.tools.get'), {
        name: 'Get provider tool',
        description: 'Retrieves a specific provider tool by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.specification:read'] }))
      .output(providerToolPresenter)
      .do(async ctx => {
        return providerToolPresenter.present({ tool: ctx.tool });
      })
  }
);
