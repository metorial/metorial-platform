import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  providerToolService,
  providerVersionService
} from '@metorial-subspace/module-catalog';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  instanceGroup,
  instanceLegacyPath,
  instancePath
} from '../../../middleware/instanceGroup';
import { providerToolPresenter } from '@metorial/presenters';

let providerToolGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerToolId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerToolId is required',
        description: 'The providerToolId path parameter is required.'
      })
    );
  }

  let tool = await providerToolService.getProviderToolById({
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
      .get(instancePath('provider-tools', 'providers.tools.list'), {
        name: 'List provider tools',
        description:
          'Returns a paginated list of provider tools. By default returns tools from the latest version. Use optional filters to get tools for a specific version.',
        legacyPaths: instanceLegacyPath('providers-tools')
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.specification:read'] }))
      .outputList(providerToolPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_version_id: v.string(),
            provider_auth_method_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Filter to tools compatible with one auth method ID, or the common compatible subset for multiple auth method IDs.'
            })
          })
        )
      )
      .do(async ctx => {
        let providerVersion = await providerVersionService.getProviderVersionById({
          instance: ctx.instance,
          providerVersionId: ctx.query.provider_version_id
        });
        let listInput = {
          instance: ctx.instance,
          providerVersion,
          providerAuthMethodIds: normalizeArrayParam(ctx.query.provider_auth_method_id)
        };

        let paginator = await providerToolService.listProviderTools(listInput);

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, tool => providerToolPresenter.present({ tool }));
      }),

    get: providerToolGroup
      .get(instancePath('provider-tools/:providerToolId', 'providers.tools.get'), {
        name: 'Get provider tool',
        description: 'Retrieves a specific provider tool by ID.',
        legacyPaths: instanceLegacyPath('providers-tools/:providerToolId')
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.specification:read'] }))
      .output(providerToolPresenter)
      .do(async ctx => {
        return providerToolPresenter.present({ tool: ctx.tool });
      })
  }
);
