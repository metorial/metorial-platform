import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceProviderAuthExportService,
  type SubspaceProviderAuthExport
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { providerAuthExportPresenter } from '../../presenters';

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
      .get(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId/exports',
          'providerDeployments.authConfigs.exports.list'
        ),
        {
          name: 'List provider auth exports',
          description: 'Returns a paginated list of provider auth exports.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
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
          providerAuthExportPresenter.present({ authExport: authExport as SubspaceProviderAuthExport })
        );
      }),

    get: providerAuthExportGroup
      .get(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId/exports/:providerAuthExportId',
          'providerDeployments.authConfigs.exports.get'
        ),
        {
          name: 'Get provider auth export',
          description: 'Retrieves a specific provider auth export by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerAuthExportPresenter)
      .do(async ctx => {
        return providerAuthExportPresenter.present({ authExport: ctx.authExport });
      }),

    create: providerAuthConfigGroup
      .post(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId/exports',
          'providerDeployments.authConfigs.exports.create'
        ),
        {
          name: 'Create provider auth export',
          description: 'Exports authentication credentials from a provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          note: v.string(),
          metadata: v.optional(v.record(v.any()), {
            description: 'Custom key-value pairs for storing additional information'
          })
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

        return providerAuthExportPresenter.present({
          authExport: authExport as SubspaceProviderAuthExport
        });
      })
  }
);
