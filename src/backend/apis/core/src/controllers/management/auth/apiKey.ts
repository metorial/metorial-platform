import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { Organization } from '@metorial/db';
import { accessService, AuthInfo } from '@metorial/module-access';
import { apiKeyService, ListApiKeysFilter } from '@metorial/module-machine-access';
import { instanceService } from '@metorial/module-organization';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';
import { apiKeyPresenter } from '../../../presenters';

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

      let res = await accessService.accessInstance({
        authInfo: auth,
        instanceId: body.instance_id
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

      let res = await accessService.accessInstance({
        authInfo: auth,
        instanceId: body.instance_id
      });

      filter = {
        type: 'instance_access_token',
        instance: res.instance,
        organization: auth.restrictions.organization
      };
    }
  } else {
    throw new ServiceError(notFoundError('endpoint'));
  }

  if (!filter) throw new Error('WTF - no filter');

  return filter;
};

let canRevealApiKey = async (d: {
  auth: AuthInfo;
  organization: Organization;
  member: any;
  apiKey: Awaited<ReturnType<typeof apiKeyService.getApiKeyById>>;
}) => {
  if (d.apiKey.machineAccess.instance) {
    return await accessService.canAccessTargetScopes({
      authInfo: d.auth,
      organization: d.organization,
      member: d.member,
      project: d.apiKey.machineAccess.instance.project,
      instance: d.apiKey.machineAccess.instance,
      possibleScopes: ['organization.api_key:reveal']
    });
  }

  return await accessService.canAccessTargetScopes({
    authInfo: d.auth,
    organization: d.organization,
    member: d.member,
    possibleScopes: ['organization.api_key:reveal']
  });
};

export let managementApiKeyController = Controller.create(
  {
    name: 'API Key',
    description: 'Read and write API key information',
    hideInDocs: true
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('api-keys', 'apiKeys.list'), {
        name: 'Get user',
        description: 'Get the current user information'
      })
      .use(checkAccess({ possibleScopes: ['organization.api_key:read'] }))
      .outputList(apiKeyPresenter)
      .query(
        'default',
        Paginator.validate(
          v.union([
            v.object({
              type: v.literal('organization_management_token', {
                description: 'List organization management tokens'
              })
            }),
            v.object({
              type: v.literal('instance_access_token', {
                description: 'List instance access tokens'
              }),
              instance_id: v.string({ description: 'Instance ID for the access token' })
            })
          ])
        )
      )
      .do(async ctx => {
        let paginator = await apiKeyService.listApiKeys({
          filter: await getApiKeyFilter(ctx.auth, ctx.organization, ctx.query as any)
        });

        let list = await paginator.run(ctx.query);
        let presented = await Promise.all(
          list.items.map(
            async apiKey =>
              await apiKeyPresenter.present({
                canReveal: await canRevealApiKey({
                  auth: ctx.auth,
                  organization: ctx.organization,
                  member: ctx.member,
                  apiKey
                }),
                apiKey
              })
          )
        );

        return Paginator.present({ ...list, items: presented }, item => item);
      }),

    get: organizationGroup
      .get(organizationManagementPath('api-keys/:apiKeyId', 'apiKeys.get'), {
        name: 'Get API key',
        description: 'Get the information of a specific API key'
      })
      .use(checkAccess({ possibleScopes: ['organization.api_key:read'] }))
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyById({
          apiKeyId: ctx.params.apiKeyId,
          organization: ctx.organization
        });

        return apiKeyPresenter.present({
          canReveal: await canRevealApiKey({
            auth: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            apiKey
          }),
          apiKey
        });
      }),

    create: organizationGroup
      .post(organizationManagementPath('api-keys', 'apiKeys.create'), {
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
            expires_at: v.optional(v.date()),
            ip_filters: v.optional(v.array(v.string()))
          })
        ])
      )
      .use(checkAccess({ possibleScopes: ['organization.api_key:write'] }))
      .output(apiKeyPresenter)
      .do(async ctx => {
        if (ctx.body.type == 'organization_management_token') {
          let { apiKey, secret } = await apiKeyService.createApiKey({
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              expiresAt: ctx.body.expires_at,
              ipFilters: ctx.body.ip_filters
            },
            context: ctx.context,
            type: 'organization_management_token',
            organization: ctx.organization,
            performedBy: ctx.actor
          });

          return apiKeyPresenter.present({
            canReveal: await canRevealApiKey({
              auth: ctx.auth,
              organization: ctx.organization,
              member: ctx.member,
              apiKey
            }),
            apiKey,
            secret
          });
        } else {
          let instance = await instanceService.getInstanceById({
            instanceId: ctx.body.instance_id,
            organization: ctx.organization,
            actor: ctx.actor,
            member: undefined
          });

          await accessService.checkTargetAccess({
            authInfo: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            project: instance.project,
            instance,
            possibleScopes: ['organization.api_key:write']
          });

          let { apiKey, secret } = await apiKeyService.createApiKey({
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              expiresAt: ctx.body.expires_at,
              ipFilters: ctx.body.ip_filters
            },
            context: ctx.context,
            type: ctx.body.type,

            instance,
            organization: ctx.organization,
            performedBy: ctx.actor
          });

          return apiKeyPresenter.present({
            canReveal: await canRevealApiKey({
              auth: ctx.auth,
              organization: ctx.organization,
              member: ctx.member,
              apiKey
            }),
            apiKey,
            secret
          });
        }
      }),

    update: organizationGroup
      .post(organizationManagementPath('api-keys/:apiKeyId', 'apiKeys.update'), {
        name: 'Update API key',
        description: 'Update the information of a specific API key'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          expires_at: v.optional(v.date()),
          ip_filters: v.optional(v.array(v.string()))
        })
      )
      .use(checkAccess({ possibleScopes: ['organization.api_key:write'] }))
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyById({
          apiKeyId: ctx.params.apiKeyId,
          organization: ctx.organization
        });

        if (apiKey.machineAccess.instance) {
          await accessService.checkTargetAccess({
            authInfo: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            project: apiKey.machineAccess.instance.project,
            instance: apiKey.machineAccess.instance,
            possibleScopes: ['organization.api_key:write']
          });
        }

        apiKey = await apiKeyService.updateApiKey({
          apiKey,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            expiresAt: ctx.body.expires_at,
            ipFilters: ctx.body.ip_filters
          },
          context: ctx.context,
          performedBy: ctx.actor
        });

        return apiKeyPresenter.present({
          canReveal: await canRevealApiKey({
            auth: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            apiKey
          }),
          apiKey
        });
      }),

    revoke: organizationGroup
      .delete(organizationManagementPath('api-keys/:apiKeyId', 'apiKeys.revoke'), {
        name: 'Revoke API key',
        description: 'Revoke a specific API key'
      })
      .use(checkAccess({ possibleScopes: ['organization.api_key:write'] }))
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyById({
          apiKeyId: ctx.params.apiKeyId,
          organization: ctx.organization
        });

        if (apiKey.machineAccess.instance) {
          await accessService.checkTargetAccess({
            authInfo: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            project: apiKey.machineAccess.instance.project,
            instance: apiKey.machineAccess.instance,
            possibleScopes: ['organization.api_key:write']
          });
        }

        apiKey = await apiKeyService.revokeApiKey({
          apiKey,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return apiKeyPresenter.present({
          canReveal: await canRevealApiKey({
            auth: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            apiKey
          }),
          apiKey
        });
      }),

    rotate: organizationGroup
      .post(organizationManagementPath('api-keys/:apiKeyId/rotate', 'apiKeys.rotate'), {
        name: 'Rotate API key',
        description: 'Rotate a specific API key'
      })
      .body(
        'default',
        v.object({
          current_expires_at: v.optional(v.date())
        })
      )
      .use(checkAccess({ possibleScopes: ['organization.api_key:write'] }))
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyById({
          apiKeyId: ctx.params.apiKeyId,
          organization: ctx.organization
        });

        if (apiKey.machineAccess.instance) {
          await accessService.checkTargetAccess({
            authInfo: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            project: apiKey.machineAccess.instance.project,
            instance: apiKey.machineAccess.instance,
            possibleScopes: ['organization.api_key:write']
          });
        }

        let res = await apiKeyService.rotateApiKey({
          apiKey,
          context: ctx.context,
          performedBy: ctx.actor,
          input: {
            currentExpiresAt: ctx.body.current_expires_at
          }
        });

        return apiKeyPresenter.present({
          canReveal: await canRevealApiKey({
            auth: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            apiKey: res.apiKey
          }),
          apiKey: res.apiKey,
          secret: res.secret
        });
      }),

    reveal: organizationGroup
      .post(organizationManagementPath('api-keys/:apiKeyId/reveal', 'apiKeys.reveal'), {
        name: 'Reveal API key',
        description: 'Reveal a specific API key'
      })
      .use(checkAccess({ possibleScopes: ['organization.api_key:reveal'] }))
      .output(apiKeyPresenter)
      .do(async ctx => {
        let apiKey = await apiKeyService.getApiKeyById({
          apiKeyId: ctx.params.apiKeyId,
          organization: ctx.organization
        });

        if (apiKey.machineAccess.instance) {
          await accessService.checkTargetAccess({
            authInfo: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            project: apiKey.machineAccess.instance.project,
            instance: apiKey.machineAccess.instance,
            possibleScopes: ['organization.api_key:reveal']
          });
        }

        let secret = await apiKeyService.revealApiKey({
          apiKey,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return apiKeyPresenter.present({
          canReveal: await canRevealApiKey({
            auth: ctx.auth,
            organization: ctx.organization,
            member: ctx.member,
            apiKey
          }),
          apiKey,
          secret
        });
      })
  }
);
