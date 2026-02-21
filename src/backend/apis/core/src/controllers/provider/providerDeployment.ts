import { convertKeysToCamelCase } from '@metorial/case';
import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceProviderDeploymentService,
  type SubspaceProviderDeployment
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerDeploymentPresenter } from '../../presenters';


export let providerDeploymentGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerDeploymentId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerDeploymentId is required',
        description: 'The providerDeploymentId path parameter is required.'
      })
    );
  }

  let deployment = await subspaceProviderDeploymentService.get({
    instance: ctx.instance,
    providerDeploymentId: ctx.params.providerDeploymentId
  });

  return { deployment };
});

export let providerDeploymentController = Controller.create(
  {
    name: 'Provider Deployments',
    description:
      'A deployment is a running instance of a provider, pinned to a specific version. Deployments support custom configuration values and user authentication.'
  },
  {
    list: instanceGroup
      .get(instancePath('provider-deployments', 'providerDeployments.list'), {
        name: 'List provider deployments',
        description: 'Returns a paginated list of provider deployments.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:read'] }))
      .outputList(providerDeploymentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string(), { description: 'Search by name' }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_version_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by version ID(s)'
            }),
            status: v.optional(v.string(), { description: 'Filter by deployment status' })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderDeploymentService.list({
          instance: ctx.instance,
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerVersionIds: normalizeArrayParam(ctx.query.provider_version_id),
          status: ctx.query.status ? [ctx.query.status] as ("active" | "archived")[] : undefined
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, deployment =>
          providerDeploymentPresenter.present({ deployment: deployment as SubspaceProviderDeployment })
        );
      }),

    get: providerDeploymentGroup
      .get(
        instancePath('provider-deployments/:providerDeploymentId', 'providerDeployments.get'),
        {
          name: 'Get provider deployment',
          description: 'Retrieves a specific provider deployment by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:read'] }))
      .output(providerDeploymentPresenter)
      .do(async ctx => {
        return providerDeploymentPresenter.present({ deployment: ctx.deployment });
      }),

    create: instanceGroup
      .post(instancePath('provider-deployments', 'providerDeployments.create'), {
        name: 'Create provider deployment',
        description: 'Creates a new provider deployment.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ examples: ['Production Deployment'] }),
          description: v.optional(
            v.string({ examples: ['Main production environment configuration'] })
          ),
          metadata: v.optional(
            v.record(v.any(), { examples: [{ team: 'platform', environment: 'production' }] }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          provider_id: v.string({
            examples: ['pro_5gHjKlMnPqRsTuVw'],
            description: 'The provider to deploy'
          }),
          locked_provider_version_id: v.optional(
            v.string({ examples: ['prv_4dEfGhJkLmNpQrSt'] }),
            { description: 'Pin this deployment to a specific provider version' }
          ),
          config: v.optional(
            v.union(
              [
                v.object(
                  {
                    type: v.literal('reference'),
                    provider_config_id: v.string({
                      description: 'Existing provider config ID',
                      examples: ['pcf_7dEfGhJkLmNpQrSt']
                    })
                  },
                  { name: 'reference', description: 'Reference an existing provider config' }
                ),
                v.object(
                  {
                    type: v.literal('new'),
                    name: v.optional(v.string({ examples: ['Default Config'] })),
                    config: v.union([
                      v.object(
                        {
                          type: v.literal('new'),
                          data: v.record(v.any(), {
                            description: 'Provider-specific configuration values',
                            examples: [{ api_key: 'sk-xxx' }]
                          })
                        },
                        { name: 'new', description: 'Provide configuration data directly' }
                      ),
                      v.object(
                        {
                          type: v.literal('vault'),
                          provider_config_vault_id: v.string({
                            description: 'Provider config vault ID',
                            examples: ['pcvt_3bCdEfGhJkLmNpQr']
                          })
                        },
                        { name: 'vault', description: 'Use a config vault template' }
                      )
                    ])
                  },
                  { name: 'new', description: 'Create a new ephemeral provider config' }
                ),
                v.string({ description: 'Shorthand: config ID' })
              ],
              {
                description:
                  'Deployment configuration. If omitted, defaults to no configuration.'
              }
            )
          )
        })
      )
      .output(providerDeploymentPresenter)
      .do(async ctx => {
        let deployment = await subspaceProviderDeploymentService.create({
          instance: ctx.instance,
          providerId: ctx.body.provider_id,
          name: ctx.body.name,
          description: ctx.body.description,
          lockedProviderVersionId: ctx.body.locked_provider_version_id,
          config: convertKeysToCamelCase(ctx.body.config),
          metadata: ctx.body.metadata
        });

        return providerDeploymentPresenter.present({
          deployment: deployment as SubspaceProviderDeployment
        });
      }),

    update: providerDeploymentGroup
      .patch(
        instancePath(
          'provider-deployments/:providerDeploymentId',
          'providerDeployments.update'
        ),
        {
          name: 'Update provider deployment',
          description: 'Updates a specific provider deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Deployment Name'] })),
          description: v.optional(
            v.string({ examples: ['Updated description for this deployment'] })
          ),
          metadata: v.optional(
            v.record(v.any(), { examples: [{ team: 'platform', environment: 'staging' }] }),
            { description: 'Custom key-value pairs for storing additional information' }
          )
        })
      )
      .output(providerDeploymentPresenter)
      .do(async ctx => {
        let deployment = await subspaceProviderDeploymentService.update({
          instance: ctx.instance,
          providerDeploymentId: ctx.deployment.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return providerDeploymentPresenter.present({
          deployment: deployment as SubspaceProviderDeployment
        });
      }),

    delete: providerDeploymentGroup
      .delete(
        instancePath(
          'provider-deployments/:providerDeploymentId',
          'providerDeployments.delete'
        ),
        {
          name: 'Delete provider deployment',
          description: 'Permanently deletes a provider deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .output(providerDeploymentPresenter)
      .do(async ctx => {
        return providerDeploymentPresenter.present({
          deployment: ctx.deployment as SubspaceProviderDeployment
        });
      })
  }
);
