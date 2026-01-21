import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderAuthImportService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { authImportPresenter } from '../../presenters';
import { SubspaceAuthImport } from '../../presenters/types';

export let providerAuthImportGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerAuthImportId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthImportId is required',
        description: 'The providerAuthImportId path parameter is required.'
      })
    );
  }

  let authImport = await subspaceProviderAuthImportService.get({
    instance: ctx.instance,
    providerAuthImportId: ctx.params.providerAuthImportId
  });

  return { authImport };
});

/**
 * Auth imports are immutable records of credential migrations.
 * Intentionally lacks update/delete operations for audit trail purposes.
 */
export let providerAuthImportController = Controller.create(
  {
    name: 'Provider Auth Imports',
    description: 'Import authentication credentials for providers.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-auth-imports', 'providerAuthImports.list'), {
        name: 'List provider auth imports',
        description: 'Returns a paginated list of provider auth imports.'
      })
      .outputList(authImportPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            provider_auth_config_id: v.optional(v.string()),
            provider_deployment_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthImportService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerAuthConfigId: ctx.query.provider_auth_config_id,
          providerDeploymentId: ctx.query.provider_deployment_id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authImport =>
          authImportPresenter.present({ authImport: authImport as SubspaceAuthImport })
        );
      }),

    get: providerAuthImportGroup
      .get(providerPath('provider-auth-imports/:providerAuthImportId', 'providerAuthImports.get'), {
        name: 'Get provider auth import',
        description: 'Retrieves a specific provider auth import by ID.'
      })
      .output(authImportPresenter)
      .do(async ctx => {
        return authImportPresenter.present({ authImport: ctx.authImport });
      }),

    create: providerInstanceGroup
      .post(providerPath('provider-auth-imports', 'providerAuthImports.create'), {
        name: 'Create provider auth import',
        description: 'Imports authentication credentials for a provider.'
      })
      .body(
        'default',
        v.object({
          note: v.string(),
          metadata: v.optional(v.record(v.any())),
          providerId: v.optional(v.string()),
          providerDeploymentId: v.optional(v.string()),
          providerAuthConfigId: v.optional(v.string()),
          providerAuthMethodId: v.optional(v.string()),
          config: v.record(v.any())
        })
      )
      .output(authImportPresenter)
      .do(async ctx => {
        let authImport = await subspaceProviderAuthImportService.create({
          instance: ctx.instance,
          providerId: ctx.body.providerId,
          providerDeploymentId: ctx.body.providerDeploymentId,
          providerAuthConfigId: ctx.body.providerAuthConfigId,
          providerAuthMethodId: ctx.body.providerAuthMethodId,
          note: ctx.body.note,
          config: ctx.body.config,
          metadata: ctx.body.metadata
        });

        return authImportPresenter.present({ authImport: authImport as SubspaceAuthImport });
      })
  }
);
