import { badRequestError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { subspaceProviderVersionService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerVersionPresenter } from '../../../presenters';

let providerVersionGroup = instanceGroup.use(async ctx => {
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
    list: instanceGroup
      .get(instancePath('provider-versions', 'providers.versions.list'), {
        name: 'List provider versions',
        description: 'Returns a paginated list of provider versions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.version:read'] }))
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
            }),
            created_at: dateFilterValidator('provider version creation time'),
            updated_at: dateFilterValidator('provider version last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderVersionService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, version =>
          providerVersionPresenter.present({ version })
        );
      }),

    get: providerVersionGroup
      .get(instancePath('provider-versions/:providerVersionId', 'providers.versions.get'), {
        name: 'Get provider version',
        description: 'Retrieves a specific provider version by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.version:read'] }))
      .output(providerVersionPresenter)
      .do(async ctx => {
        return providerVersionPresenter.present({ version: ctx.version });
      })
  }
);
