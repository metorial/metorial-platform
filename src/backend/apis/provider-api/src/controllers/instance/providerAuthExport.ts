import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderAuthExportService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { authExportPresenter, authExportWithValuePresenter } from '../../presenters';
import { SubspaceAuthExport } from '../../presenters/types';

export let providerAuthExportGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerAuthExportId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthExportId is required',
        description: 'The providerAuthExportId path parameter is required.'
      })
    );
  }

  let authExport = await subspaceProviderAuthExportService.get({
    instance: ctx.instance,
    providerAuthExportId: ctx.params.providerAuthExportId
  });

  return { authExport };
});

/**
 * Auth exports are immutable audit records representing point-in-time snapshots.
 * Intentionally lacks update/delete operations to preserve data integrity.
 */
export let providerAuthExportController = Controller.create(
  {
    name: 'Provider Auth Exports',
    description: 'Export authentication credentials from providers.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-auth-exports', 'providerAuthExports.list'), {
        name: 'List provider auth exports',
        description: 'Returns a paginated list of provider auth exports.'
      })
      .outputList(authExportPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            provider_auth_config_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthExportService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerAuthConfigId: ctx.query.provider_auth_config_id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authExport =>
          authExportPresenter.present({ authExport: authExport as SubspaceAuthExport })
        );
      }),

    get: providerAuthExportGroup
      .get(providerPath('provider-auth-exports/:providerAuthExportId', 'providerAuthExports.get'), {
        name: 'Get provider auth export',
        description: 'Retrieves a specific provider auth export by ID.'
      })
      .output(authExportPresenter)
      .do(async ctx => {
        return authExportPresenter.present({ authExport: ctx.authExport });
      }),

    create: providerInstanceGroup
      .post(providerPath('provider-auth-exports', 'providerAuthExports.create'), {
        name: 'Create provider auth export',
        description: 'Exports authentication credentials from a provider.'
      })
      .body(
        'default',
        v.object({
          note: v.string(),
          metadata: v.optional(v.record(v.any())),
          providerAuthConfigId: v.string()
        })
      )
      .output(authExportWithValuePresenter)
      .do(async ctx => {
        let authExport = await subspaceProviderAuthExportService.create({
          instance: ctx.instance,
          providerAuthConfigId: ctx.body.providerAuthConfigId,
          note: ctx.body.note,
          metadata: ctx.body.metadata
        });

        return authExportWithValuePresenter.present({ authExport: authExport as SubspaceAuthExport });
      })
  }
);
