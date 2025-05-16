import { badRequestError, forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { AuthInfo } from '@metorial/module-access';
import { apiKeyService, ListApiKeysFilter } from '@metorial/module-machine-access';
import { instanceService, organizationService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { userGroup } from '../../middleware/userGroup';
import { apiKeyPresenter } from '../../presenters';

export let getApiKeyFilter = async (
  auth: AuthInfo,
  body:
    | {
        type: 'user_auth_token';
      }
    | {
        type: 'instance_access_token';
        instance_id?: string;
      }
    | {
        type: 'organization_management_token';
        organization_id?: string;
      }
) => {
  let filter: ListApiKeysFilter | undefined = undefined;

  if (auth.type == 'user') {
    filter = {
      type: 'user_auth_token',
      user: auth.user
    };

    if (body.type == 'instance_access_token') {
      if (!body.instance_id) {
        throw new ServiceError(
          badRequestError({
            message: 'Instance ID is required for instance access token'
          })
        );
      }

      let res = await instanceService.getInstanceByIdForUser({
        instanceId: body.instance_id,
        user: auth.user
      });

      filter = {
        type: 'instance_access_token',
        instance: res.instance,
        organization: res.organization
      };
    } else if (body.type == 'organization_management_token') {
      if (!body.organization_id) {
        throw new ServiceError(
          badRequestError({
            message: 'Organization ID is required for organization management token'
          })
        );
      }

      let res = await organizationService.getOrganizationByIdForUser({
        organizationId: body.organization_id,
        user: auth.user
      });

      filter = {
        type: 'organization_management_token',
        organization: res.organization
      };
    }
  } else if (auth.restrictions.type == 'organization') {
    if (body.type == 'user_auth_token') {
      throw new ServiceError(
        forbiddenError({
          message: 'You are not permitted to list user auth tokens'
        })
      );
    }

    filter = {
      type: 'organization_management_token',
      organization: auth.restrictions.organization
    };

    if (body.type == 'instance_access_token') {
      if (!body.instance_id) {
        throw new ServiceError(
          badRequestError({
            message: 'Instance ID is required for instance access token'
          })
        );
      }

      let instance = await instanceService.getInstanceById({
        instanceId: body.instance_id,
        organization: auth.restrictions.organization
      });

      filter = {
        type: 'instance_access_token',
        instance,
        organization: auth.restrictions.organization
      };
    }
  } else {
    throw new ServiceError(notFoundError('endpoint'));
  }

  if (!filter) throw new Error('WTF - no filter');

  return filter;
};

export let dashboardApiKeyController = Controller.create(
  {
    name: 'API Key',
    description: 'Read and write API key information'
  },
  {
    list: userGroup
      .get(Path('api-keys', 'apiKeys.list'), {
        name: 'Get user',
        description: 'Get the current user information'
      })
      .outputList(apiKeyPresenter)
      .query(
        'default',
        Paginator.validate(
          v.union([
            v.object({
              type: v.literal('organization_management_token'),
              organization_id: v.string()
            }),
            v.object({
              type: v.literal('user_auth_token')
            }),
            v.object({
              type: v.literal('instance_access_token'),
              instance_id: v.string()
            })
          ])
        )
      )
      .do(async ctx => {
        let paginator = await apiKeyService.listApiKeys({
          filter: await getApiKeyFilter(ctx.auth, ctx.query as any)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, apiKey => apiKeyPresenter.present({ apiKey }));
      }),

    get: userGroup
      .get(Path('api-keys/:apiKeyId', 'apiKeys.get'), {
        name: 'Get API key',
        description: 'Get the information of a specific API key'
      })
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyByIdForUser({
          apiKeyId: ctx.params.apiKeyId,
          user: ctx.user
        });

        return apiKeyPresenter.present({ apiKey });
      }),

    create: userGroup
      .post(Path('api-keys', 'apiKeys.create'), {
        name: 'Create API key',
        description: 'Create a new API key'
      })
      .body(
        'default',
        v.intersection([
          v.union([
            v.object({
              type: v.literal('organization_management_token'),
              organization_id: v.string()
            }),
            v.object({
              type: v.literal('user_auth_token')
            }),
            v.object({
              type: v.enumOf([
                'instance_access_token_secret',
                'instance_access_token_publishable'
              ]),
              instance_id: v.string()
            })
          ]),
          v.object({
            name: v.string(),
            description: v.optional(v.string()),
            expires_at: v.optional(v.date())
          })
        ])
      )
      .output(apiKeyPresenter)
      .do(async ctx => {
        if (ctx.body.type == 'organization_management_token') {
          let organization = await organizationService.getOrganizationByIdForUser({
            organizationId: ctx.body.organization_id,
            user: ctx.user
          });

          let { apiKey, secret } = await apiKeyService.createApiKey({
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              expiresAt: ctx.body.expires_at
            },
            context: ctx.context,
            type: 'organization_management_token',
            organization: organization.organization,
            performedBy: organization.member.actor
          });

          return apiKeyPresenter.present({ apiKey, secret });
        } else if (ctx.body.type == 'user_auth_token') {
          if (ctx.auth.machineAccess) {
            throw new ServiceError(
              badRequestError({
                message: 'Cannot create user auth token using API'
              })
            );
          }

          let { apiKey, secret } = await apiKeyService.createApiKey({
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              expiresAt: ctx.body.expires_at
            },
            context: ctx.context,
            type: 'user_auth_token',
            user: ctx.user
          });

          return apiKeyPresenter.present({ apiKey, secret });
        } else {
          let res = await instanceService.getInstanceByIdForUser({
            instanceId: ctx.body.instance_id,
            user: ctx.user
          });

          let { apiKey, secret } = await apiKeyService.createApiKey({
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              expiresAt: ctx.body.expires_at
            },
            context: ctx.context,
            type: ctx.body.type,
            organization: res.organization,
            instance: res.instance,
            performedBy: res.member.actor
          });

          return apiKeyPresenter.present({ apiKey, secret });
        }
      }),

    update: userGroup
      .post(Path('api-keys/:apiKeyId', 'apiKeys.update'), {
        name: 'Update API key',
        description: 'Update the information of a specific API key'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          expires_at: v.optional(v.date())
        })
      )
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyByIdForUser({
          apiKeyId: ctx.params.apiKeyId,
          user: ctx.user
        });

        let org = apiKey.machineAccess.organization
          ? await organizationService.getOrganizationByIdForUser({
              organizationId: apiKey.machineAccess.organization.id,
              user: ctx.user
            })
          : undefined;

        apiKey = await apiKeyService.updateApiKey({
          apiKey,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            expiresAt: ctx.body.expires_at
          },
          context: ctx.context,
          performedBy: org?.member.actor
        });

        return apiKeyPresenter.present({ apiKey });
      }),

    revoke: userGroup
      .delete(Path('api-keys/:apiKeyId', 'apiKeys.revoke'), {
        name: 'Revoke API key',
        description: 'Revoke a specific API key'
      })
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyByIdForUser({
          apiKeyId: ctx.params.apiKeyId,
          user: ctx.user
        });

        let org = apiKey.machineAccess.organization
          ? await organizationService.getOrganizationByIdForUser({
              organizationId: apiKey.machineAccess.organization.id,
              user: ctx.user
            })
          : undefined;

        apiKey = await apiKeyService.revokeApiKey({
          apiKey,
          context: ctx.context,
          performedBy: org?.member.actor
        });

        return apiKeyPresenter.present({ apiKey });
      }),

    rotate: userGroup
      .post(Path('api-keys/:apiKeyId/rotate', 'apiKeys.rotate'), {
        name: 'Rotate API key',
        description: 'Rotate a specific API key'
      })
      .body(
        'default',
        v.object({
          current_expires_at: v.optional(v.date())
        })
      )
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyByIdForUser({
          apiKeyId: ctx.params.apiKeyId,
          user: ctx.user
        });

        let org = apiKey.machineAccess.organization
          ? await organizationService.getOrganizationByIdForUser({
              organizationId: apiKey.machineAccess.organization.id,
              user: ctx.user
            })
          : undefined;

        let res = await apiKeyService.rotateApiKey({
          apiKey,
          context: ctx.context,
          performedBy: org?.member.actor,
          input: {
            currentExpiresAt: ctx.body.current_expires_at
          }
        });

        return apiKeyPresenter.present({ apiKey: res.apiKey, secret: res.secret });
      }),

    reveal: userGroup
      .post(Path('api-keys/:apiKeyId/reveal', 'apiKeys.reveal'), {
        name: 'Reveal API key',
        description: 'Reveal a specific API key'
      })
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyByIdForUser({
          apiKeyId: ctx.params.apiKeyId,
          user: ctx.user
        });

        let org = apiKey.machineAccess.organization
          ? await organizationService.getOrganizationByIdForUser({
              organizationId: apiKey.machineAccess.organization.id,
              user: ctx.user
            })
          : undefined;

        let secret = await apiKeyService.revealApiKey({
          apiKey,
          context: ctx.context,
          performedBy: org?.member.actor
        });

        return apiKeyPresenter.present({ apiKey, secret });
      })
  }
);
