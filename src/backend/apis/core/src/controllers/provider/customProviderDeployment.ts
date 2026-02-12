import { badRequestError, ServiceError } from '@metorial/error';
import { customProviderDeploymentService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import {
  subspaceCustomProviderDeploymentPresenter,
  subspaceCustomProviderDeploymentLogsPresenter
} from '../../presenters';
import {
  SubspaceCustomProviderDeployment,
  SubspaceCustomProviderDeploymentLogs
} from '../../presenters/types';
import { customProviderGroup } from './customProvider';

export let customProviderDeploymentGroup = customProviderGroup.use(async ctx => {
  if (!ctx.params.customProviderDeploymentId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderDeploymentId is required',
        description: 'The customProviderDeploymentId path parameter is required.'
      })
    );
  }

  let customProviderDeployment = await customProviderDeploymentService.get({
    instance: ctx.instance,
    customProviderDeploymentId: ctx.params.customProviderDeploymentId
  });

  return { customProviderDeployment };
});

export let customProviderDeploymentController = Controller.create(
  {
    name: 'Custom Provider Deployments',
    description:
      'Deployments track the build and deployment process of custom provider versions. View deployment status and logs.'
  },
  {
    list: customProviderGroup
      .get(
        instancePath(
          'custom-providers/:customProviderId/deployments',
          'customProviders.deployments.list'
        ),
        {
          name: 'List custom provider deployments',
          description: 'Returns a paginated list of deployments for a custom provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(subspaceCustomProviderDeploymentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by status (queued, deploying, succeeded, failed)'
            }),
            ids: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by deployment IDs'
            }),
            custom_provider_version_ids: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by version IDs'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await customProviderDeploymentService.list({
          instance: ctx.instance,
          customProviderIds: [ctx.customProvider.id],
          status: normalizeArrayParam(ctx.query.status) as
            | ('queued' | 'deploying' | 'succeeded' | 'failed')[]
            | undefined,
          ids: normalizeArrayParam(ctx.query.ids),
          customProviderVersionIds: normalizeArrayParam(ctx.query.custom_provider_version_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customProviderDeployment =>
          subspaceCustomProviderDeploymentPresenter.present({
            customProviderDeployment:
              customProviderDeployment as SubspaceCustomProviderDeployment
          })
        );
      }),

    get: customProviderDeploymentGroup
      .get(
        instancePath(
          'custom-providers/:customProviderId/deployments/:customProviderDeploymentId',
          'customProviders.deployments.get'
        ),
        {
          name: 'Get custom provider deployment',
          description: 'Retrieves a specific deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(subspaceCustomProviderDeploymentPresenter)
      .do(async ctx => {
        return subspaceCustomProviderDeploymentPresenter.present({
          customProviderDeployment:
            ctx.customProviderDeployment as SubspaceCustomProviderDeployment
        });
      }),

    getLogs: customProviderDeploymentGroup
      .get(
        instancePath(
          'custom-providers/:customProviderId/deployments/:customProviderDeploymentId/logs',
          'customProviders.deployments.getLogs'
        ),
        {
          name: 'Get deployment logs',
          description: 'Retrieves the build and deployment logs for a deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(subspaceCustomProviderDeploymentLogsPresenter)
      .do(async ctx => {
        let logs = await customProviderDeploymentService.getLogs({
          instance: ctx.instance,
          customProviderDeploymentId: ctx.customProviderDeployment.id
        });

        return subspaceCustomProviderDeploymentLogsPresenter.present({
          logs: logs as SubspaceCustomProviderDeploymentLogs
        });
      })
  }
);
