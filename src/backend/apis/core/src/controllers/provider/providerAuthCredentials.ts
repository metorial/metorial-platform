import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceReferenceAuthCredentialsService } from '@metorial/module-subspace-reference';
import { subspaceProviderAuthCredentialsService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerPath } from '../../middleware/providerGroup';
import { providerAuthCredentialsPresenter } from '../../presenters';
import { SubspaceAuthCredentials } from '../../presenters/types';
import { providerDeploymentGroup } from './providerDeployment';

export let providerAuthCredentialsGroup = providerDeploymentGroup.use(async ctx => {
  if (!ctx.params.providerAuthCredentialsId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthCredentialsId is required',
        description: 'The providerAuthCredentialsId path parameter is required.'
      })
    );
  }

  let authCredentials = await subspaceProviderAuthCredentialsService.get({
    instance: ctx.instance,
    providerAuthCredentialsId: ctx.params.providerAuthCredentialsId
  });

  return { authCredentials };
});

export let providerAuthCredentialsController = Controller.create(
  {
    name: 'Provider Auth Credentials',
    description:
      'Auth credentials store your OAuth app registration (client ID, client secret, and scopes). These are the app-level credentials you get from a service like GitHub or Slack.'
  },
  {
    list: providerDeploymentGroup
      .get(providerPath('provider-deployments/:providerDeploymentId/auth-credentials', 'providerDeployments.authCredentials.list'), {
        name: 'List provider auth credentials',
        description: 'Returns a paginated list of provider auth credentials.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(providerAuthCredentialsPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by credential ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthCredentialsService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: [ctx.deployment.providerId]
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authCredentials =>
          providerAuthCredentialsPresenter.present({
            authCredentials: authCredentials as SubspaceAuthCredentials
          })
        );
      }),

    get: providerAuthCredentialsGroup
      .get(
        providerPath(
          'provider-deployments/:providerDeploymentId/auth-credentials/:providerAuthCredentialsId',
          'providerDeployments.authCredentials.get'
        ),
        {
          name: 'Get provider auth credentials',
          description: 'Retrieves specific provider auth credentials by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        return providerAuthCredentialsPresenter.present({
          authCredentials: ctx.authCredentials
        });
      }),

    create: providerDeploymentGroup
      .post(providerPath('provider-deployments/:providerDeploymentId/auth-credentials', 'providerDeployments.authCredentials.create'), {
        name: 'Create provider auth credentials',
        description: 'Creates new provider auth credentials.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .body(
        'default',
        v.object({
          name: v.string({ examples: ['GitHub OAuth'] }),
          description: v.optional(
            v.string({ examples: ['OAuth credentials for GitHub API'] })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ app_name: 'My GitHub App', created_by: 'admin@company.com' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          config: v.object({
            type: v.literal('oauth'),
            clientId: v.string({
              description: 'OAuth client ID',
              examples: ['Iv1.abc123def456']
            }),
            clientSecret: v.string({
              description: 'OAuth client secret',
              examples: ['gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx']
            }),
            scopes: v.array(v.string({ examples: ['repo'] }), {
              description: 'OAuth scopes to request',
              examples: [['repo', 'read:user', 'read:org']]
            })
          })
        })
      )
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        let authCredentials = await subspaceProviderAuthCredentialsService.create({
          instance: ctx.instance,
          providerId: ctx.deployment.providerId,
          name: ctx.body.name,
          description: ctx.body.description,
          config: ctx.body.config,
          metadata: ctx.body.metadata
        });

        await subspaceReferenceAuthCredentialsService
          .create({
            instance: ctx.instance,
            authCredentials: {
              id: authCredentials.id,
              providerId: ctx.deployment.providerId,
              providerAuthMethodId: null,
              name: authCredentials.name,
              createdAt: authCredentials.createdAt
            }
          })
          .catch(err => console.error('Failed to store subspace reference:', err));

        return providerAuthCredentialsPresenter.present({
          authCredentials: authCredentials as SubspaceAuthCredentials
        });
      }),

    update: providerAuthCredentialsGroup
      .patch(
        providerPath(
          'provider-deployments/:providerDeploymentId/auth-credentials/:providerAuthCredentialsId',
          'providerDeployments.authCredentials.update'
        ),
        {
          name: 'Update provider auth credentials',
          description: 'Updates specific provider auth credentials.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()), {
            description: 'Custom key-value pairs for storing additional information'
          })
        })
      )
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        let authCredentials = await subspaceProviderAuthCredentialsService.update({
          instance: ctx.instance,
          providerAuthCredentialsId: ctx.authCredentials.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return providerAuthCredentialsPresenter.present({
          authCredentials: authCredentials as SubspaceAuthCredentials
        });
      }),

    delete: providerAuthCredentialsGroup
      .delete(
        providerPath(
          'provider-deployments/:providerDeploymentId/auth-credentials/:providerAuthCredentialsId',
          'providerDeployments.authCredentials.delete'
        ),
        {
          name: 'Delete provider auth credentials',
          description: 'Permanently deletes provider auth credentials.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        await subspaceProviderAuthCredentialsService.delete({
          instance: ctx.instance,
          providerAuthCredentialsId: ctx.authCredentials.id
        });

        await subspaceReferenceAuthCredentialsService
          .delete({
            instance: ctx.instance,
            id: ctx.authCredentials.id
          })
          .catch(err => console.error('Failed to remove subspace reference:', err));

        return providerAuthCredentialsPresenter.present({
          authCredentials: ctx.authCredentials
        });
      })
  }
);
