import { Organization } from '@metorial/db';
import { badRequestError, forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { AuthInfo } from '@metorial/module-access';
import { apiKeyService, ListApiKeysFilter } from '@metorial/module-machine-access';
import { instanceService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { apiKeyPresenter } from '../../presenters';

export let getApiKeyFilter = async (
  auth: AuthInfo,
  organization: Organization,
  body:
    | {
        type: 'instance_access_token';
        instance_id?: string;
      }
    | {
        type: 'organization_management_token';
      }
) => {
  let filter: ListApiKeysFilter | undefined = undefined;

  if (auth.type == 'user') {
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

      if (res.instance.organizationOid != organization.oid) {
        throw new ServiceError(
          forbiddenError({
            message: 'You are not permitted to access this instance'
          })
        );
      }

      filter = {
        type: 'instance_access_token',
        instance: res.instance,
        organization: res.organization
      };
    } else if (body.type == 'organization_management_token') {
      filter = {
        type: 'organization_management_token',
        organization
      };
    }
  } else if (auth.restrictions.type == 'organization') {
    if (auth.restrictions.organization.oid != organization.oid) {
      throw new ServiceError(
        forbiddenError({
          message: 'You are not permitted to access this organization'
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
    list: organizationGroup
      .get(Path('/dashboard/organizations/:organizationId/api-keys', 'apiKeys.list'), {
        name: 'Get user',
        description: 'Get the current user information'
      })
      .use(isDashboardGroup())
      .outputList(apiKeyPresenter)
      .query(
        'default',
        Paginator.validate(
          v.union([
            v.object({
              type: v.literal('organization_management_token')
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
          filter: await getApiKeyFilter(ctx.auth, ctx.organization, ctx.query as any)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, apiKey => apiKeyPresenter.present({ apiKey }));
      }),

    get: organizationGroup
      .get(
        Path('/dashboard/organizations/:organizationId/api-keys/:apiKeyId', 'apiKeys.get'),
        {
          name: 'Get API key',
          description: 'Get the information of a specific API key'
        }
      )
      .use(isDashboardGroup())
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyById({
          apiKeyId: ctx.params.apiKeyId,
          organization: ctx.organization
        });

        return apiKeyPresenter.present({ apiKey });
      }),

    create: organizationGroup
      .post(Path('/dashboard/organizations/:organizationId/api-keys', 'apiKeys.create'), {
        name: 'Create API key',
        description: 'Create a new API key'
      })
      .body(
        'default',
        v.intersection([
          v.union([
            v.object({
              type: v.literal('organization_management_token')
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
      .use(isDashboardGroup())
      .output(apiKeyPresenter)
      .do(async ctx => {
        if (ctx.body.type == 'organization_management_token') {
          let { apiKey, secret } = await apiKeyService.createApiKey({
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              expiresAt: ctx.body.expires_at
            },
            context: ctx.context,
            type: 'organization_management_token',
            organization: ctx.organization,
            performedBy: ctx.actor
          });

          return apiKeyPresenter.present({ apiKey, secret });
        } else {
          let instance = await instanceService.getInstanceById({
            instanceId: ctx.body.instance_id,
            organization: ctx.organization
          });

          let { apiKey, secret } = await apiKeyService.createApiKey({
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              expiresAt: ctx.body.expires_at
            },
            context: ctx.context,
            type: ctx.body.type,

            instance,
            organization: ctx.organization,
            performedBy: ctx.actor
          });

          return apiKeyPresenter.present({ apiKey, secret });
        }
      }),

    update: organizationGroup
      .post(
        Path('/dashboard/organizations/:organizationId/api-keys/:apiKeyId', 'apiKeys.update'),
        {
          name: 'Update API key',
          description: 'Update the information of a specific API key'
        }
      )
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          expires_at: v.optional(v.date())
        })
      )
      .use(isDashboardGroup())
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyById({
          apiKeyId: ctx.params.apiKeyId,
          organization: ctx.organization
        });

        apiKey = await apiKeyService.updateApiKey({
          apiKey,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            expiresAt: ctx.body.expires_at
          },
          context: ctx.context,
          performedBy: ctx.actor
        });

        return apiKeyPresenter.present({ apiKey });
      }),

    revoke: organizationGroup
      .delete(
        Path('/dashboard/organizations/:organizationId/api-keys/:apiKeyId', 'apiKeys.revoke'),
        {
          name: 'Revoke API key',
          description: 'Revoke a specific API key'
        }
      )
      .use(isDashboardGroup())
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyById({
          apiKeyId: ctx.params.apiKeyId,
          organization: ctx.organization
        });

        apiKey = await apiKeyService.revokeApiKey({
          apiKey,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return apiKeyPresenter.present({ apiKey });
      }),

    rotate: organizationGroup
      .post(
        Path(
          '/dashboard/organizations/:organizationId/api-keys/:apiKeyId/rotate',
          'apiKeys.rotate'
        ),
        {
          name: 'Rotate API key',
          description: 'Rotate a specific API key'
        }
      )
      .body(
        'default',
        v.object({
          current_expires_at: v.optional(v.date())
        })
      )
      .use(isDashboardGroup())
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyById({
          apiKeyId: ctx.params.apiKeyId,
          organization: ctx.organization
        });

        let res = await apiKeyService.rotateApiKey({
          apiKey,
          context: ctx.context,
          performedBy: ctx.actor,
          input: {
            currentExpiresAt: ctx.body.current_expires_at
          }
        });

        return apiKeyPresenter.present({ apiKey: res.apiKey, secret: res.secret });
      }),

    reveal: organizationGroup
      .post(
        Path(
          '/dashboard/organizations/:organizationId/api-keys/:apiKeyId/reveal',
          'apiKeys.reveal'
        ),
        {
          name: 'Reveal API key',
          description: 'Reveal a specific API key'
        }
      )
      .use(isDashboardGroup())
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyById({
          apiKeyId: ctx.params.apiKeyId,
          organization: ctx.organization
        });

        let secret = await apiKeyService.revealApiKey({
          apiKey,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return apiKeyPresenter.present({ apiKey, secret });
      })
  }
);
