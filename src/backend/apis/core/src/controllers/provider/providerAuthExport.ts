import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceReferenceAuthExportService } from '@metorial/module-subspace-reference';
import { subspaceProviderAuthExportService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerPath } from '../../middleware/providerGroup';
import { providerAuthExportPresenter } from '../../presenters';
import { SubspaceAuthExport } from '../../presenters/types';
import { providerAuthConfigGroup } from './providerAuthConfig';

export let providerAuthExportGroup = providerAuthConfigGroup.use(async ctx => {
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
    description:
      'An auth export lets you extract OAuth tokens or credentials from Metorial to use in other systems, avoiding duplicate authentication flows.'
  },
  {
    list: providerAuthConfigGroup
      .get(providerPath('provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId/exports', 'providerDeployments.authConfigs.exports.list'), {
        name: 'List provider auth exports',
        description: 'Returns a paginated list of provider auth exports.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(providerAuthExportPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await subspaceProviderAuthExportService.list({
          instance: ctx.instance,
          providerIds: [ctx.deployment.providerId],
          providerAuthConfigIds: [ctx.authConfig.id]
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authExport =>
          providerAuthExportPresenter.present({ authExport: authExport as SubspaceAuthExport })
        );
      }),

    get: providerAuthExportGroup
      .get(providerPath('provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId/exports/:providerAuthExportId', 'providerDeployments.authConfigs.exports.get'), {
        name: 'Get provider auth export',
        description: 'Retrieves a specific provider auth export by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerAuthExportPresenter)
      .do(async ctx => {
        return providerAuthExportPresenter.present({ authExport: ctx.authExport });
      }),

    create: providerAuthConfigGroup
      .post(providerPath('provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId/exports', 'providerDeployments.authConfigs.exports.create'), {
        name: 'Create provider auth export',
        description: 'Exports authentication credentials from a provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .body(
        'default',
        v.object({
          note: v.string(),
          metadata: v.optional(v.record(v.any()), { description: 'Custom key-value pairs for storing additional information' })
        })
      )
      .output(providerAuthExportPresenter)
      .do(async ctx => {
        let authExport = await subspaceProviderAuthExportService.create({
          instance: ctx.instance,
          providerAuthConfigId: ctx.authConfig.id,
          note: ctx.body.note,
          ip: ctx.context.ip,
          ua: ctx.context.ua ?? '',
          metadata: ctx.body.metadata
        });

        await subspaceReferenceAuthExportService
          .create({
            instance: ctx.instance,
            authExport: {
              id: authExport.id,
              providerAuthConfigId: ctx.authConfig.id,
              createdAt: authExport.createdAt
            }
          })
          .catch(err => console.error('Failed to store subspace reference:', err));

        return providerAuthExportPresenter.present({ authExport: authExport as SubspaceAuthExport });
      })
  }
);
