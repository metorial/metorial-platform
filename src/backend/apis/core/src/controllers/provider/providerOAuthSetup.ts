import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderOAuthSetupService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { subspaceProviderOAuthSetupPresenter } from '../../presenters';
import { SubspaceProviderOAuthSetup } from '../../presenters/types';
import { providerDeploymentGroup } from './providerDeployment';

export let providerOAuthSetupGroup = providerDeploymentGroup.use(async ctx => {
  if (!ctx.params.providerOAuthSetupId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerOAuthSetupId is required',
        description: 'The providerOAuthSetupId path parameter is required.'
      })
    );
  }

  let providerOAuthSetup = await subspaceProviderOAuthSetupService.get({
    instance: ctx.instance,
    providerOAuthSetupId: ctx.params.providerOAuthSetupId
  });

  return { providerOAuthSetup };
});

export let providerOAuthSetupController = Controller.create(
  {
    name: 'Provider OAuth Setups',
    description:
      'OAuth setups provide a way to authenticate users with providers that require OAuth. Create a setup, send users to the URL, and an auth config is created when they complete the flow.'
  },
  {
    list: providerDeploymentGroup
      .get(
        instancePath(
          'provider-deployments/:providerDeploymentId/oauth-setups',
          'providerDeployments.oauthSetups.list'
        ),
        {
          name: 'List OAuth setups',
          description: 'Returns a paginated list of OAuth setups for a provider deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(subspaceProviderOAuthSetupPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await subspaceProviderOAuthSetupService.list({
          instance: ctx.instance,
          providerDeploymentId: ctx.deployment.id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerOAuthSetup =>
          subspaceProviderOAuthSetupPresenter.present({
            providerOAuthSetup: providerOAuthSetup as SubspaceProviderOAuthSetup
          })
        );
      }),

    get: providerOAuthSetupGroup
      .get(
        instancePath(
          'provider-deployments/:providerDeploymentId/oauth-setups/:providerOAuthSetupId',
          'providerDeployments.oauthSetups.get'
        ),
        {
          name: 'Get OAuth setup',
          description: 'Retrieves a specific OAuth setup by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(subspaceProviderOAuthSetupPresenter)
      .do(async ctx => {
        return subspaceProviderOAuthSetupPresenter.present({
          providerOAuthSetup: ctx.providerOAuthSetup as SubspaceProviderOAuthSetup
        });
      }),

    create: providerDeploymentGroup
      .post(
        instancePath(
          'provider-deployments/:providerDeploymentId/oauth-setups',
          'providerDeployments.oauthSetups.create'
        ),
        {
          name: 'Create OAuth setup',
          description:
            'Creates a new OAuth setup. Returns a URL that users should visit to complete the OAuth flow.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({
            description: 'Display name for this setup',
            examples: ['GitHub OAuth for John']
          }),
          description: v.optional(
            v.string({
              description: 'Optional description',
              examples: ['OAuth setup for development']
            })
          ),
          metadata: v.optional(v.record(v.any(), { examples: [{ user_id: 'usr_123' }] }), {
            description: 'Custom key-value pairs for storing additional information'
          }),
          redirect_url: v.optional(
            v.string({
              description: 'URL to redirect to after OAuth completion',
              examples: ['https://app.example.com/oauth/callback']
            })
          ),
          is_ephemeral: v.optional(
            v.boolean({
              description: 'Whether this setup should be automatically cleaned up'
            })
          ),
          provider_auth_credentials_id: v.optional(
            v.string({
              description: 'ID of existing auth credentials to use',
              examples: ['pcr_1aBcDeFgHjKlMnPq']
            })
          ),
          provider_auth_method_id: v.optional(
            v.string({
              description: 'ID of the auth method to use',
              examples: ['pam_1aBcDeFgHjKlMnPq']
            })
          ),
          config: v.record(v.any(), {
            description: 'OAuth configuration values',
            examples: [{ scopes: ['read', 'write'] }]
          })
        })
      )
      .output(subspaceProviderOAuthSetupPresenter)
      .do(async ctx => {
        let providerOAuthSetup = await subspaceProviderOAuthSetupService.create({
          instance: ctx.instance,
          providerId: ctx.deployment.providerId,
          providerDeploymentId: ctx.deployment.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          redirectUrl: ctx.body.redirect_url,
          isEphemeral: ctx.body.is_ephemeral,
          providerAuthCredentialsId: ctx.body.provider_auth_credentials_id,
          providerAuthMethodId: ctx.body.provider_auth_method_id,
          config: ctx.body.config
        });

        return subspaceProviderOAuthSetupPresenter.present({
          providerOAuthSetup: providerOAuthSetup as SubspaceProviderOAuthSetup
        });
      }),

    update: providerOAuthSetupGroup
      .patch(
        instancePath(
          'provider-deployments/:providerDeploymentId/oauth-setups/:providerOAuthSetupId',
          'providerDeployments.oauthSetups.update'
        ),
        {
          name: 'Update OAuth setup',
          description: 'Updates an existing OAuth setup.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Setup Name'] })),
          description: v.optional(v.string({ examples: ['Updated description'] })),
          metadata: v.optional(v.record(v.any(), { examples: [{ updated: true }] }), {
            description: 'Custom key-value pairs for storing additional information'
          })
        })
      )
      .output(subspaceProviderOAuthSetupPresenter)
      .do(async ctx => {
        let providerOAuthSetup = await subspaceProviderOAuthSetupService.update({
          instance: ctx.instance,
          providerOAuthSetupId: ctx.providerOAuthSetup.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return subspaceProviderOAuthSetupPresenter.present({
          providerOAuthSetup: providerOAuthSetup as SubspaceProviderOAuthSetup
        });
      })
  }
);
