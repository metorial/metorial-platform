import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { db } from '@metorial/db';
import {
  consumerAccessRequestService,
  consumerProfileService,
  ConsumerProviderCatalogEntry,
  ConsumerProviderCatalogItem,
  consumerProviderCatalogService,
  consumerProviderDeploymentService,
  consumerProviderSetupSessionService
} from '@metorial/module-consumer';
import { magicMcpEndpointService, magicMcpServerService } from '@metorial/module-magic';
import { Controller } from '@metorial/rest';
import { addMinutes } from 'date-fns';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';
import { hasFlags } from '../../middleware/hasFlags';
import {
  consumerAccessRequestPresenter,
  consumerProviderPresenter,
  magicMcpServerPresenter,
  portalOAuthAuthorizationPresenter,
  portalOAuthClientPresenter,
  providerSetupSessionPresenter
} from '../../presenters';

let consumerProviderItemGroup = consumerGroup.use(async ctx => {
  if (!ctx.params.catalogItemId) {
    throw new ServiceError(
      badRequestError({
        message: 'catalogItemId is required',
        description: 'The catalogItemId path parameter is required.'
      })
    );
  }

  let consumerProvider = await consumerProviderCatalogService.getCatalogItem({
    instance: ctx.instance,
    catalogItemId: ctx.params.catalogItemId,
    consumerProfile: ctx.consumerProfile,
    accessTags: ctx.accessTags
  });

  return { consumerProvider };
});

let consumerProviderGroup = consumerGroup.use(async ctx => {
  if (!ctx.params.catalogItemId) {
    throw new ServiceError(
      badRequestError({
        message: 'catalogItemId is required',
        description: 'The catalogItemId path parameter is required.'
      })
    );
  }

  let consumerProvider = await consumerProviderCatalogService.getCatalogEntry({
    instance: ctx.instance,
    catalogItemId: ctx.params.catalogItemId,
    consumerProfile: ctx.consumerProfile,
    accessTags: ctx.accessTags,
    includeCapabilities: true
  });

  return { consumerProvider };
});

let requireProviderTemplate = (
  consumerProvider: ConsumerProviderCatalogItem | ConsumerProviderCatalogEntry
) => {
  if (consumerProvider.type != 'provider_template') {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This action is only supported for provider templates.'
      })
    );
  }

  return consumerProvider;
};

let portalOAuthClientGroup = consumerGroup.use(async ctx => {
  if (!ctx.params.portalAuthClientId) {
    throw new ServiceError(
      badRequestError({
        message: 'portalAuthClientId is required',
        description: 'The portalAuthClientId path parameter is required.'
      })
    );
  }

  let portalOAuthClient = await db.portalAuthClient.findFirst({
    where: {
      id: ctx.params.portalAuthClientId,
      portal: {
        instanceOid: ctx.instance.oid,
        surfaceOid: ctx.consumerSurface.oid
      }
    },
    include: {
      portal: true,
      magicMcpServer: true,
      magicMcpEndpoint: true
    }
  });
  if (!portalOAuthClient) {
    throw new ServiceError(notFoundError('portal.oauth_client'));
  }

  return { portalOAuthClient };
});

let portalOAuthAuthorizationGroup = consumerGroup.use(async ctx => {
  if (!ctx.params.portalAuthAttemptId) {
    throw new ServiceError(
      badRequestError({
        message: 'portalAuthAttemptId is required',
        description: 'The portalAuthAttemptId path parameter is required.'
      })
    );
  }

  let portalOAuthAuthorization = await db.portalAuthAttempt.findFirst({
    where: {
      id: ctx.params.portalAuthAttemptId,
      portalAuthClient: {
        portal: {
          instanceOid: ctx.instance.oid,
          surfaceOid: ctx.consumerSurface.oid
        }
      }
    },
    include: {
      consumerProfile: true,
      portalAuthClient: {
        include: {
          portal: true,
          magicMcpServer: true,
          magicMcpEndpoint: true
        }
      }
    }
  });
  if (!portalOAuthAuthorization) {
    throw new ServiceError(notFoundError('portal.oauth_authorization'));
  }

  if (
    portalOAuthAuthorization.consumerProfile &&
    portalOAuthAuthorization.consumerProfile.oid != ctx.consumerProfile.oid
  ) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'This portal OAuth authorization belongs to a different consumer profile.'
      })
    );
  }

  return { portalOAuthAuthorization };
});

export let consumerProviderController = Controller.create(
  {
    name: 'Consumer Providers',
    description: 'Browse and configure portal providers from the consumer side.',
    hideInDocs: true
  },
  {
    getPortalOAuthClient: portalOAuthClientGroup
      .get(
        consumerPath(
          'portal-oauth-clients/:portalAuthClientId',
          'consumerInternal.oauth.clients.get'
        ),
        {
          name: 'Get portal OAuth client',
          description:
            'Returns one portal OAuth client visible to the current portal consumer.'
        }
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(portalOAuthClientPresenter)
      .do(async ctx => {
        return portalOAuthClientPresenter.present({
          portalAuthClient: ctx.portalOAuthClient
        });
      }),

    getPortalOAuthAuthorization: portalOAuthAuthorizationGroup
      .get(
        consumerPath(
          'portal-oauth-attempts/:portalAuthAttemptId',
          'consumerInternal.oauth.authorizations.get'
        ),
        {
          name: 'Get portal OAuth authorization',
          description:
            'Returns the current portal OAuth authorization request for the active consumer.'
        }
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(portalOAuthAuthorizationPresenter)
      .do(async ctx => {
        return portalOAuthAuthorizationPresenter.present({
          portalOAuthAuthorization: ctx.portalOAuthAuthorization
        });
      }),

    acceptPortalOAuthAuthorization: portalOAuthAuthorizationGroup
      .post(
        consumerPath(
          'portal-oauth-attempts/:portalAuthAttemptId/accept',
          'consumerInternal.oauth.authorizations.accept'
        ),
        {
          name: 'Accept portal OAuth authorization',
          description:
            'Approves a pending portal OAuth authorization request and returns the redirect URL.'
        }
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(portalOAuthAuthorizationPresenter)
      .do(async ctx => {
        if (ctx.portalOAuthAuthorization.status != 'pending') {
          throw new ServiceError(
            preconditionFailedError({
              message: 'This portal OAuth authorization is no longer pending.'
            })
          );
        }

        if (
          !ctx.portalOAuthAuthorization.portalAuthClient.magicMcpServerOid &&
          !ctx.portalOAuthAuthorization.portalAuthClient.magicMcpEndpointOid &&
          !ctx.portalOAuthAuthorization.magicMcpEndpointOid
        ) {
          throw new ServiceError(
            preconditionFailedError({
              message:
                'Select at least one Magic MCP server before approving this portal OAuth authorization.'
            })
          );
        }

        let now = new Date();
        let portalOAuthAuthorization = await db.portalAuthAttempt.update({
          where: {
            id: ctx.portalOAuthAuthorization.id
          },
          data: {
            status: 'authorized',
            consumerProfileOid: ctx.consumerProfile.oid,
            authorizedAt: now,
            deniedAt: null,
            authorizationCode:
              ctx.portalOAuthAuthorization.authorizationCode ?? crypto.randomUUID(),
            authorizationCodeExpiresAt: addMinutes(now, 10)
          },
          include: {
            consumerProfile: true,
            portalAuthClient: {
              include: {
                portal: true,
                magicMcpServer: true,
                magicMcpEndpoint: true
              }
            }
          }
        });

        return portalOAuthAuthorizationPresenter.present({
          portalOAuthAuthorization
        });
      }),

    connectPortalOAuthAuthorizationToMagicMcpEndpoint: portalOAuthAuthorizationGroup
      .post(
        consumerPath(
          'portal-oauth-attempts/:portalAuthAttemptId/connect-magic-mcp-endpoint',
          'consumerInternal.oauth.authorizations.connectMagicMcpEndpoint'
        ),
        {
          name: 'Connect portal OAuth authorization to magic MCP endpoint',
          description:
            'Links a pending portal OAuth authorization request to a consumer-owned magic MCP endpoint.'
        }
      )
      .use(hasFlags(['paid-portals', 'portals-access', 'magic-mcp-enabled']))
      .body(
        'default',
        v.object({
          magic_mcp_endpoint_id: v.string()
        })
      )
      .output(portalOAuthAuthorizationPresenter)
      .do(async ctx => {
        if (ctx.portalOAuthAuthorization.status != 'pending') {
          throw new ServiceError(
            preconditionFailedError({
              message: 'This portal OAuth authorization is no longer pending.'
            })
          );
        }

        if (
          ctx.portalOAuthAuthorization.portalAuthClient.magicMcpServerOid ||
          ctx.portalOAuthAuthorization.portalAuthClient.magicMcpEndpointOid
        ) {
          throw new ServiceError(
            preconditionFailedError({
              message:
                'This portal OAuth authorization already targets a specific magic MCP route.'
            })
          );
        }

        let magicMcpEndpoint = await magicMcpEndpointService.getMagicMcpEndpointById({
          magicMcpEndpointId: ctx.body.magic_mcp_endpoint_id,
          instance: ctx.instance,
          accessTags: ctx.accessTags
        });

        if (magicMcpEndpoint.consumerProfileOid != ctx.consumerProfile.oid) {
          throw new ServiceError(
            preconditionFailedError({
              message:
                'You can only link this portal OAuth authorization to a magic MCP endpoint you own.'
            })
          );
        }

        if (magicMcpEndpoint.servers.length == 0) {
          throw new ServiceError(
            preconditionFailedError({
              message:
                'Add at least one Magic MCP server to the endpoint before linking it to this portal OAuth authorization.'
            })
          );
        }

        let portalOAuthAuthorization = await db.portalAuthAttempt.update({
          where: {
            id: ctx.portalOAuthAuthorization.id
          },
          data: {
            consumerProfileOid: ctx.consumerProfile.oid,
            magicMcpEndpointOid: magicMcpEndpoint.oid
          },
          include: {
            consumerProfile: true,
            portalAuthClient: {
              include: {
                portal: true,
                magicMcpServer: true,
                magicMcpEndpoint: true
              }
            }
          }
        });

        return portalOAuthAuthorizationPresenter.present({
          portalOAuthAuthorization
        });
      }),

    rejectPortalOAuthAuthorization: portalOAuthAuthorizationGroup
      .post(
        consumerPath(
          'portal-oauth-attempts/:portalAuthAttemptId/reject',
          'consumerInternal.oauth.authorizations.reject'
        ),
        {
          name: 'Reject portal OAuth authorization',
          description:
            'Rejects a pending portal OAuth authorization request and returns the redirect URL.'
        }
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(portalOAuthAuthorizationPresenter)
      .do(async ctx => {
        if (ctx.portalOAuthAuthorization.status != 'pending') {
          throw new ServiceError(
            preconditionFailedError({
              message: 'This portal OAuth authorization is no longer pending.'
            })
          );
        }

        let portalOAuthAuthorization = await db.portalAuthAttempt.update({
          where: {
            id: ctx.portalOAuthAuthorization.id
          },
          data: {
            status: 'denied',
            consumerProfileOid:
              ctx.portalOAuthAuthorization.consumerProfileOid ?? ctx.consumerProfile.oid,
            deniedAt: new Date()
          },
          include: {
            consumerProfile: true,
            portalAuthClient: {
              include: {
                portal: true,
                magicMcpServer: true,
                magicMcpEndpoint: true
              }
            }
          }
        });

        return portalOAuthAuthorizationPresenter.present({
          portalOAuthAuthorization
        });
      }),

    list: consumerGroup
      .get(consumerPath('providers', 'providers.list'), {
        name: 'List consumer providers',
        description: 'Returns the unified portal catalog with consumer availability.'
      })
      .use(hasFlags(['paid-portals', 'portals-access']))
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string())
          })
        )
      )
      .outputList(consumerProviderPresenter)
      .do(async ctx => {
        let list = await consumerProviderCatalogService.listCatalogEntries({
          instance: ctx.instance,
          consumerProfile: ctx.consumerProfile,
          search: ctx.query.search,
          accessTags: ctx.accessTags,
          includeCapabilities: false,
          pagination: {
            limit: ctx.query.limit,
            after: ctx.query.after,
            before: ctx.query.before,
            cursor: ctx.query.cursor,
            order: ctx.query.order
          }
        });

        return Paginator.present(list, consumerProvider =>
          consumerProviderPresenter.present({ consumerProvider })
        );
      }),

    get: consumerProviderGroup
      .get(consumerPath('providers/:catalogItemId', 'providers.get'), {
        name: 'Get consumer provider',
        description:
          'Returns one portal catalog item with any available setup capability data.'
      })
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(consumerProviderPresenter)
      .do(async ctx => {
        return consumerProviderPresenter.present({
          consumerProvider: ctx.consumerProvider
        });
      }),

    requestAccess: consumerProviderItemGroup
      .post(
        consumerPath('providers/:catalogItemId/request-access', 'providers.requestAccess'),
        {
          name: 'Request consumer provider access',
          description: 'Creates an access request for a portal catalog item.'
        }
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          message: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(consumerAccessRequestPresenter)
      .do(async ctx => {
        if (ctx.consumerProvider.availability != 'request_access') {
          throw new ServiceError(
            preconditionFailedError({
              message: 'This catalog item is already available to the current consumer.'
            })
          );
        }

        let consumerProfile = await consumerProfileService.getConsumerProfileById({
          consumerSurface: ctx.consumerSurface,
          consumerProfileId: ctx.consumerProfile.id
        });
        let consumerAccessRequest =
          await consumerAccessRequestService.createConsumerAccessRequest({
            consumerProfile,
            accessRequest:
              ctx.consumerProvider.type == 'provider_template'
                ? {
                    type: 'provider_template',
                    providerTemplate: ctx.consumerProvider.providerTemplate
                  }
                : {
                    type: 'magic_mcp_server',
                    magicMcpServer: ctx.consumerProvider.magicMcpServer
                  },
            input: {
              message: ctx.body.message,
              metadata: ctx.body.metadata
            }
          });

        return consumerAccessRequestPresenter.present({
          consumerAccessRequest
        });
      }),

    startSetup: consumerProviderItemGroup
      .post(consumerPath('providers/:catalogItemId/setup', 'providers.setup'), {
        name: 'Start consumer provider setup',
        description: 'Starts an OAuth setup flow for a portal provider template.'
      })
      .use(hasFlags(['paid-portals', 'portals-access']))
      .body(
        'default',
        v.object({
          provider_auth_method_id: v.optional(v.string())
        })
      )
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        let consumerProvider = requireProviderTemplate(ctx.consumerProvider);
        let setupSession = await consumerProviderSetupSessionService.startSetupSession({
          instance: ctx.instance,
          context: ctx.context,
          accessTags: ctx.accessTags!,
          consumerSurface: ctx.consumerSurface,
          consumerProfile: ctx.consumerProfile,
          providerTemplateId: consumerProvider.providerTemplate.id,
          input: {
            providerAuthMethodId: ctx.body.provider_auth_method_id
          }
        });

        return providerSetupSessionPresenter.present({
          setupSession
        });
      }),

    getSetup: consumerProviderItemGroup
      .get(
        consumerPath(
          'providers/:catalogItemId/setup/:providerSetupSessionId',
          'providers.getSetup'
        ),
        {
          name: 'Get consumer provider setup',
          description:
            'Reads the status of an OAuth setup flow for a portal provider template.'
        }
      )
      .use(hasFlags(['paid-portals', 'portals-access']))
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        let consumerProvider = requireProviderTemplate(ctx.consumerProvider);
        let setupSession = await consumerProviderSetupSessionService.getSetupSession({
          instance: ctx.instance,
          consumerProfile: ctx.consumerProfile,
          providerTemplate: consumerProvider.providerTemplate,
          providerSetupSessionId: ctx.params.providerSetupSessionId
        });

        return providerSetupSessionPresenter.present({
          setupSession
        });
      }),

    deploy: consumerProviderItemGroup
      .post(consumerPath('providers/:catalogItemId/deploy', 'providers.deploy'), {
        name: 'Deploy consumer provider',
        description: 'Creates an owned Magic MCP server from a portal provider template.'
      })
      .use(hasFlags(['paid-portals', 'portals-access', 'magic-mcp-enabled']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          config: v.optional(v.record(v.any())),
          auth: v.optional(
            v.union([
              v.object({
                type: v.literal('setup_session'),
                provider_setup_session_id: v.string()
              }),
              v.object({
                type: v.literal('manual'),
                provider_auth_method_id: v.string(),
                value: v.record(v.any())
              })
            ])
          )
        })
      )
      .output(magicMcpServerPresenter)
      .do(async ctx => {
        let consumerProvider = requireProviderTemplate(ctx.consumerProvider);
        let magicMcpServer = await consumerProviderDeploymentService.deployProvider({
          organization: ctx.organization,
          performedBy: ctx.actor!,
          instance: ctx.instance,
          context: ctx.context,
          consumerProfile: ctx.consumerProfile,
          accessTags: ctx.accessTags!,
          providerTemplateId: consumerProvider.providerTemplate.id,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            config: ctx.body.config,
            auth:
              ctx.body.auth?.type == 'setup_session'
                ? {
                    type: 'setup_session',
                    providerSetupSessionId: ctx.body.auth.provider_setup_session_id
                  }
                : ctx.body.auth?.type == 'manual'
                  ? {
                      type: 'manual',
                      providerAuthMethodId: ctx.body.auth.provider_auth_method_id,
                      value: ctx.body.auth.value
                    }
                  : undefined
          }
        });

        let hydratedMagicMcpServer = await magicMcpServerService.getMagicMcpServerById({
          instance: ctx.instance,
          magicMcpServerId: magicMcpServer.id,
          accessTags: ctx.accessTags
        });

        return magicMcpServerPresenter.present({
          magicMcpServer: hydratedMagicMcpServer
        });
      })
  }
);
