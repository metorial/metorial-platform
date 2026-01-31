import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderVersionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { providerVersionPresenter } from '../../presenters';
import { SubspaceVersion } from '../../presenters/types';
import { providerGroup } from './provider';

export let providerVersionGroup = providerGroup.use(async ctx => {
  if (!ctx.params.providerVersionId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerVersionId is required',
        description: 'The providerVersionId path parameter is required.'
      })
    );
  }

  let version = await subspaceProviderVersionService.get({
    instance: ctx.instance,
    providerVersionId: ctx.params.providerVersionId
  });

  return { version };
});

export let providerVersionController = Controller.create(
  {
    name: 'Provider Versions',
    description:
      'A version is a specific release of a provider (e.g., v1.2.0). Each version has its own tools, auth methods, and config schema. Deployments are pinned to a version for security reasons.'
  },
  {
    list: providerGroup
      .get(instancePath('providers/:providerId/versions', 'providers.versions.list'), {
        name: 'List provider versions',
        description: 'Returns a paginated list of provider versions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(providerVersionPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await subspaceProviderVersionService.list({
          instance: ctx.instance,
          providerIds: [ctx.provider.id]
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, version =>
          providerVersionPresenter.present({ version: version as SubspaceVersion })
        );
      }),

    get: providerVersionGroup
      .get(
        instancePath(
          'providers/:providerId/versions/:providerVersionId',
          'providers.versions.get'
        ),
        {
          name: 'Get provider version',
          description: 'Retrieves a specific provider version by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerVersionPresenter)
      .do(async ctx => {
        return providerVersionPresenter.present({ version: ctx.version });
      })
  }
);
