import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderToolService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { providerToolPresenter } from '../../presenters';

import { providerGroup } from './provider';

export let providerToolGroup = providerGroup.use(async ctx => {
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
    list: providerGroup
      .get(instancePath('providers/:providerId/tools', 'providers.tools.list'), {
        name: 'List provider tools',
        description:
          'Returns a paginated list of provider tools. By default returns tools from the latest version. Use optional filters to get tools for a specific version.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(providerToolPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_version_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderToolService.list({
          instance: ctx.instance,
          providerVersion: ctx.query.provider_version_id ?? ctx.provider.currentVersion!.id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, tool => providerToolPresenter.present({ tool }));
      }),

    get: providerToolGroup
      .get(
        instancePath('providers/:providerId/tools/:providerToolId', 'providers.tools.get'),
        {
          name: 'Get provider tool',
          description: 'Retrieves a specific provider tool by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(providerToolPresenter)
      .do(async ctx => {
        return providerToolPresenter.present({ tool: ctx.tool });
      })
  }
);
