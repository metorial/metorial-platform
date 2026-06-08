import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceProviderService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerPresenter } from '../../../presenters';

let providerGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerId is required',
        description: 'The providerId path parameter is required.'
      })
    );
  }

  let provider = await subspaceProviderService.get({
    instance: ctx.instance,
    providerId: ctx.params.providerId
  });

  return { provider };
});

export let providerController = Controller.create(
  {
    name: 'Providers',
    description:
      'A provider is a read-only template for an MCP server integration (like GitHub or Slack). To use a provider, create a deployment from it.'
  },
  {
    list: instanceGroup
      .get(instancePath('providers', 'providers.list'), {
        name: 'List providers',
        description: 'Returns a paginated list of providers.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(providerPresenter)
      .query(
        'mt_2026_01_01_magnetar',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            })
          })
        ),
        v => v
      )
      .query(
        'mt_2026_04_01_consumer',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            })
          })
        ),
        v => v
      )
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),

            capabilities: v.optional(
              v.object({
                supportsConfig: v.optional(v.boolean()),
                supportsAuth: v.optional(v.boolean()),
                supportsOAuth: v.optional(v.boolean()),
                supportsCallbacks: v.optional(v.boolean()),
                supportsOAuthAutoRegistration: v.optional(v.boolean()),
                supportsAuthExport: v.optional(v.boolean()),
                supportsAuthImport: v.optional(v.boolean())
              })
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderService.list({
          instance: ctx.instance,

          ids: normalizeArrayParam(ctx.query.id),
          capabilities: ctx.query.capabilities
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, provider => providerPresenter.present({ provider }));
      }),

    get: providerGroup
      .get(instancePath('providers/:providerId', 'providers.get'), {
        name: 'Get provider',
        description: 'Retrieves a specific provider by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(providerPresenter)
      .do(async ctx => {
        return providerPresenter.present({ provider: ctx.provider });
      })
  }
);
