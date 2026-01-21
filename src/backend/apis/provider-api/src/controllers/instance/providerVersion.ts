import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderVersionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { versionPresenter } from '../../presenters';
import { SubspaceVersion } from '../../presenters/types';

export let providerVersionGroup = providerInstanceGroup.use(async ctx => {
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
    description: 'Browse provider versions.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-versions', 'providerVersions.list'), {
        name: 'List provider versions',
        description: 'Returns a paginated list of provider versions.'
      })
      .outputList(versionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderVersionService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, version =>
          versionPresenter.present({ version: version as SubspaceVersion })
        );
      }),

    get: providerVersionGroup
      .get(providerPath('provider-versions/:providerVersionId', 'providerVersions.get'), {
        name: 'Get provider version',
        description: 'Retrieves a specific provider version by ID.'
      })
      .output(versionPresenter)
      .do(async ctx => {
        return versionPresenter.present({ version: ctx.version });
      })
  }
);
