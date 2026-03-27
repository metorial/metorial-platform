import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceCustomProviderDeploymentService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import {
  subspaceCustomProviderDeploymentLogsPresenter,
  subspaceCustomProviderDeploymentPresenter
} from '../../presenters';

let customProviderDeploymentGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.customProviderDeploymentId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderDeploymentId is required',
        description: 'The customProviderDeploymentId path parameter is required.'
      })
    );
  }

  let customProviderDeployment = await subspaceCustomProviderDeploymentService.get({
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
    list: instanceGroup
      .get(instancePath('custom-provider-deployments', 'customProviders.deployments.list'), {
        name: 'List custom provider deployments',
        description: 'Returns a paginated list of deployments for a custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.deployment:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .outputList(subspaceCustomProviderDeploymentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['queued', 'deploying', 'succeeded', 'failed']),
                v.array(v.enumOf(['queued', 'deploying', 'succeeded', 'failed']))
              ]),
              { description: 'Filter by status (queued, deploying, succeeded, failed)' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by deployment IDs'
            }),
            custom_provider_version_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by version IDs' }
            ),
            custom_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by custom provider IDs'
            }),
            created_at: dateFilterValidator('custom provider deployment creation time'),
            updated_at: dateFilterValidator('custom provider deployment last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceCustomProviderDeploymentService.list({
          instance: ctx.instance,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          customProviderVersionIds: normalizeArrayParam(ctx.query.custom_provider_version_id),
          customProviderIds: normalizeArrayParam(ctx.query.custom_provider_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customProviderDeployment =>
          subspaceCustomProviderDeploymentPresenter.present({
            customProviderDeployment: customProviderDeployment
          })
        );
      }),

    get: customProviderDeploymentGroup
      .get(
        instancePath(
          'custom-provider-deployments/:customProviderDeploymentId',
          'customProviders.deployments.get'
        ),
        {
          name: 'Get custom provider deployment',
          description: 'Retrieves a specific deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.deployment:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(subspaceCustomProviderDeploymentPresenter)
      .do(async ctx => {
        return subspaceCustomProviderDeploymentPresenter.present({
          customProviderDeployment: ctx.customProviderDeployment
        });
      }),

    getLogs: customProviderDeploymentGroup
      .get(
        instancePath(
          'custom-provider-deployments/:customProviderDeploymentId/logs',
          'customProviders.deployments.getLogs'
        ),
        {
          name: 'Get deployment logs',
          description: 'Retrieves the build and deployment logs for a deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.deployment:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(subspaceCustomProviderDeploymentLogsPresenter)
      .do(async ctx => {
        let logs = await subspaceCustomProviderDeploymentService.getLogs({
          instance: ctx.instance,
          customProviderDeploymentId: ctx.customProviderDeployment.id
        });

        return subspaceCustomProviderDeploymentLogsPresenter.present({
          logs
        });
      })
  }
);
