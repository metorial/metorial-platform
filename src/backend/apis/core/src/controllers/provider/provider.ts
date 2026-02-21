import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderService, type SubspaceProvider } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerPresenter } from '../../presenters';


export let providerGroup = instanceGroup.use(async ctx => {
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
        'default',
        Paginator.validate(
          v.object({
            publisher_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by publisher ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, provider =>
          providerPresenter.present({ provider: provider as SubspaceProvider })
        );
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
      }),

    update: providerGroup
      .patch(instancePath('providers/:providerId', 'providers.update'), {
        name: 'Update provider',
        description: 'Updates a provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated GitHub'] })),
          description: v.optional(v.string({ examples: ['Updated GitHub MCP server'] })),
          slug: v.optional(v.string({ examples: ['updated-github'] })),
          image: v.optional(v.string({ examples: ['https://example.com/updated-image.png'] })),
          skills: v.optional(v.array(v.string()), {
            description: 'List of skill tags for this provider'
          })
        })
      )
      .output(providerPresenter)
      .do(async ctx => {
        let provider = await subspaceProviderService.update({
          instance: ctx.instance,
          providerId: ctx.provider.id,
          name: ctx.body.name,
          description: ctx.body.description,
          slug: ctx.body.slug,
          image: ctx.body.image,
          skills: ctx.body.skills
        });

        return providerPresenter.present({ provider: provider as SubspaceProvider });
      })
  }
);
