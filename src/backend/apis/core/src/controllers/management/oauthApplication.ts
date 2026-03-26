import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { oauthApplicationService } from '@metorial/module-machine-access';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import {
  oauthApplicationClientSecretPresenter,
  oauthApplicationPresenter
} from '../../presenters';

let oauthApplicationManagementGroup = organizationGroup.use(async ctx => {
  if (!ctx.params.oauthApplicationId) {
    throw new ServiceError(
      badRequestError({
        message: 'oauthApplicationId is required'
      })
    );
  }

  let oauthApplication = await oauthApplicationService.getOAuthApplicationById({
    organization: ctx.organization,
    oauthApplicationId: ctx.params.oauthApplicationId
  });

  return { oauthApplication };
});

let oauthApplicationClientSecretManagementGroup = oauthApplicationManagementGroup.use(
  async ctx => {
    if (!ctx.params.oauthApplicationClientSecretId) {
      throw new ServiceError(
        badRequestError({
          message: 'oauthApplicationClientSecretId is required'
        })
      );
    }

    let oauthApplicationClientSecret =
      await oauthApplicationService.getOAuthApplicationClientSecretById({
        oauthApplication: ctx.oauthApplication,
        oauthApplicationClientSecretId: ctx.params.oauthApplicationClientSecretId
      });

    return { oauthApplicationClientSecret };
  }
);

export let oauthApplicationManagementController = Controller.create(
  {
    name: 'OAuth Application',
    description: 'Create and manage OAuth applications for an organization'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('oauth/apps', 'oauth.apps.list'), {
        name: 'List organization OAuth applications',
        description:
          'Returns a paginated list of OAuth applications owned by the organization.'
      })
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:read'] }))
      .outputList(oauthApplicationPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              { description: 'Filter by application status' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await oauthApplicationService.listOAuthApplications({
          organization: ctx.organization,
          statuses: normalizeArrayParam(ctx.query.status)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, oauthApplication =>
          oauthApplicationPresenter.present({ oauthApplication })
        );
      }),

    get: oauthApplicationManagementGroup
      .get(organizationManagementPath('oauth/apps/:oauthApplicationId', 'oauth.apps.get'), {
        name: 'Get organization OAuth application',
        description: 'Retrieves a specific OAuth application owned by the organization.'
      })
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:read'] }))
      .output(oauthApplicationPresenter)
      .do(async ctx => {
        return oauthApplicationPresenter.present({
          oauthApplication: ctx.oauthApplication
        });
      }),

    create: organizationGroup
      .post(organizationManagementPath('oauth/apps', 'oauth.apps.create'), {
        name: 'Create organization OAuth application',
        description: 'Creates a new OAuth application that belongs to the organization.'
      })
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:write'] }))
      .body(
        'default',
        v.object({
          access_level: v.enumOf(['organization'], {
            description: 'Whether the app is organization-scoped or globally installable'
          }),
          allow_token_exchange_without_client_secret: v.optional(
            v.boolean({
              description:
                'Allow authorization_code and device_code token exchanges without a client secret'
            })
          ),
          name: v.string({
            description: 'OAuth application display name'
          }),
          description: v.optional(
            v.string({
              description: 'OAuth application description'
            })
          ),
          website_url: v.optional(
            v.string({
              description: 'OAuth application website URL'
            })
          ),
          privacy_policy_url: v.optional(
            v.string({
              description: 'OAuth application privacy policy URL'
            })
          ),
          terms_of_service_url: v.optional(
            v.string({
              description: 'OAuth application terms of service URL'
            })
          ),
          redirect_uris: v.optional(
            v.array(
              v.string({
                description: 'Allowed redirect URI'
              }),
              {
                description: 'Allowed redirect URIs for interactive OAuth flows'
              }
            )
          ),
          scopes: v.array(v.string(), {
            description: 'OAuth scopes requested by this application'
          })
        })
      )
      .output(oauthApplicationPresenter)
      .do(async ctx => {
        let oauthApplication = await oauthApplicationService.createOAuthApplication({
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context,
          input: {
            type: 'user_facing',
            accessLevel: ctx.body.access_level,
            allowClientSecretlessTokenExchange:
              ctx.body.allow_token_exchange_without_client_secret,
            name: ctx.body.name,
            description: ctx.body.description,
            websiteUrl: ctx.body.website_url,
            privacyPolicyUrl: ctx.body.privacy_policy_url,
            termsOfServiceUrl: ctx.body.terms_of_service_url,
            redirectUris: ctx.body.redirect_uris,
            scopes: ctx.body.scopes
          }
        });

        return oauthApplicationPresenter.present({ oauthApplication });
      }),

    update: oauthApplicationManagementGroup
      .patch(
        organizationManagementPath('oauth/apps/:oauthApplicationId', 'oauth.apps.update'),
        {
          name: 'Update organization OAuth application',
          description: 'Updates an existing OAuth application owned by the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:write'] }))
      .body(
        'default',
        v.object({
          access_level: v.optional(
            v.enumOf(['organization'], {
              description: 'Whether the app is organization-scoped or globally installable'
            })
          ),
          allow_token_exchange_without_client_secret: v.optional(
            v.boolean({
              description:
                'Allow authorization_code and device_code token exchanges without a client secret'
            })
          ),
          name: v.optional(
            v.string({
              description: 'OAuth application display name'
            })
          ),
          description: v.optional(
            v.nullable(
              v.string({
                description: 'OAuth application description'
              })
            )
          ),
          website_url: v.optional(
            v.nullable(
              v.string({
                description: 'OAuth application website URL'
              })
            )
          ),
          privacy_policy_url: v.optional(
            v.nullable(
              v.string({
                description: 'OAuth application privacy policy URL'
              })
            )
          ),
          terms_of_service_url: v.optional(
            v.nullable(
              v.string({
                description: 'OAuth application terms of service URL'
              })
            )
          ),
          redirect_uris: v.optional(
            v.array(
              v.string({
                description: 'Allowed redirect URI'
              }),
              {
                description: 'Allowed redirect URIs for interactive OAuth flows'
              }
            )
          ),
          scopes: v.optional(
            v.array(v.string(), {
              description: 'OAuth scopes requested by this application'
            })
          )
        })
      )
      .output(oauthApplicationPresenter)
      .do(async ctx => {
        let oauthApplication = await oauthApplicationService.updateOAuthApplication({
          oauthApplication: ctx.oauthApplication,
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context,
          input: {
            accessLevel: ctx.body.access_level,
            allowClientSecretlessTokenExchange:
              ctx.body.allow_token_exchange_without_client_secret,
            name: ctx.body.name,
            description: ctx.body.description,
            websiteUrl: ctx.body.website_url,
            privacyPolicyUrl: ctx.body.privacy_policy_url,
            termsOfServiceUrl: ctx.body.terms_of_service_url,
            redirectUris: ctx.body.redirect_uris,
            scopes: ctx.body.scopes
          }
        });

        return oauthApplicationPresenter.present({ oauthApplication });
      }),

    delete: oauthApplicationManagementGroup
      .delete(
        organizationManagementPath('oauth/apps/:oauthApplicationId', 'oauth.apps.delete'),
        {
          name: 'Delete organization OAuth application',
          description: 'Archives an OAuth application owned by the organization.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:write'] }))
      .output(oauthApplicationPresenter)
      .do(async ctx => {
        let oauthApplication = await oauthApplicationService.archiveOAuthApplication({
          oauthApplication: ctx.oauthApplication,
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context
        });

        return oauthApplicationPresenter.present({ oauthApplication });
      }),

    createClientSecret: oauthApplicationManagementGroup
      .post(
        organizationManagementPath(
          'oauth/apps/:oauthApplicationId/client-secrets',
          'oauth.apps.clientSecrets.create'
        ),
        {
          name: 'Create OAuth application client secret',
          description: 'Creates a new client secret for an OAuth application.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:write'] }))
      .output(oauthApplicationClientSecretPresenter)
      .do(async ctx => {
        let oauthApplicationClientSecret =
          await oauthApplicationService.createOAuthApplicationClientSecret({
            oauthApplication: ctx.oauthApplication
          });

        return oauthApplicationClientSecretPresenter.present({
          oauthApplicationClientSecret,
          secret: oauthApplicationClientSecret.secret
        });
      }),

    deleteClientSecret: oauthApplicationClientSecretManagementGroup
      .delete(
        organizationManagementPath(
          'oauth/apps/:oauthApplicationId/client-secrets/:oauthApplicationClientSecretId',
          'oauth.apps.clientSecrets.delete'
        ),
        {
          name: 'Delete OAuth application client secret',
          description: 'Deletes a client secret from an OAuth application.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.oauth_app:write'] }))
      .output(oauthApplicationClientSecretPresenter)
      .do(async ctx => {
        let oauthApplicationClientSecret =
          await oauthApplicationService.deleteOAuthApplicationClientSecret({
            oauthApplicationClientSecret: ctx.oauthApplicationClientSecret
          });

        return oauthApplicationClientSecretPresenter.present({
          oauthApplicationClientSecret
        });
      })
  }
);
