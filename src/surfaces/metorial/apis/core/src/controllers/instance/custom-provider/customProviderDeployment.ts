import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { customProviderDeploymentService } from '@metorial-subspace/module-custom-provider';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  subspaceCustomProviderDeploymentLogsPresenter,
  subspaceCustomProviderDeploymentPresenter
} from '@metorial/presenters';

let customProviderDeploymentGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.customProviderDeploymentId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderDeploymentId is required',
        description: 'The customProviderDeploymentId path parameter is required.'
      })
    );
  }

  let customProviderDeployment =
    await customProviderDeploymentService.getCustomProviderDeploymentById({
      instance: ctx.instance,
      customProviderDeploymentId: ctx.params.customProviderDeploymentId
    });

  return { customProviderDeployment };
});

export let customProviderDeploymentController = Controller.create(
  {
    name: 'Custom Provider Deployments',
    description:
      'A custom provider deployment is a build and rollout of one custom provider version.'
  },
  {
    list: integrationsGroup
      .get(instancePath('custom-provider-deployments', 'customProviders.deployments.list'), {
        name: 'List custom provider deployments',
        description: 'Returns a paginated list of custom provider deployments.'
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
              { description: 'Only return deployments with one of these statuses.' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return deployments with one of these IDs.'
            }),
            custom_provider_version_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description:
                  'Only return deployments of one of these custom provider versions.'
              }
            ),
            custom_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return deployments of one of these custom providers.'
            }),
            created_at: dateFilterValidator('custom provider deployment creation time'),
            updated_at: dateFilterValidator('custom provider deployment last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await customProviderDeploymentService.listCustomProviderDeployments({
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
          description: 'Retrieves a custom provider deployment.'
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
          name: 'Get custom provider deployment logs',
          description:
            'Retrieves the build and deployment logs for a custom provider deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.deployment:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(subspaceCustomProviderDeploymentLogsPresenter)
      .do(async ctx => {
        let logs = await customProviderDeploymentService.getLogs({
          instance: ctx.instance,
          customProviderDeployment: ctx.customProviderDeployment
        });

        return subspaceCustomProviderDeploymentLogsPresenter.present({
          logs
        });
      })
  }
);
