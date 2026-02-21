import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceProviderVersionService,
  type SubspaceProviderVersion
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { providerVersionPresenter } from '../../presenters';

import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
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
      .get(instancePath('provider-versions', 'providers.versions.list'), {
        name: 'List provider versions',
        description: 'Returns a paginated list of provider versions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(providerVersionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by version ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderVersionService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, version =>
          providerVersionPresenter.present({ version: version as SubspaceProviderVersion })
        );
      }),

    get: providerVersionGroup
      .get(instancePath('provider-versions/:providerVersionId', 'providers.versions.get'), {
        name: 'Get provider version',
        description: 'Retrieves a specific provider version by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(providerVersionPresenter)
      .do(async ctx => {
        return providerVersionPresenter.present({ version: ctx.version });
      })
  }
);
