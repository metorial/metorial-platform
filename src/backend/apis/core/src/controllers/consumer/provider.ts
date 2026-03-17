import { badRequestError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  ConsumerProviderCatalogItem,
  ConsumerProviderCatalogEntry,
  consumerAccessRequestService,
  consumerProfileService,
  consumerProviderCatalogService,
  consumerProviderDeploymentService,
  consumerProviderSetupSessionService
} from '@metorial/module-consumer';
import { magicMcpServerService } from '@metorial/module-magic';
import { Controller } from '@metorial/rest';
import { hasFlags } from '../../middleware/hasFlags';
import { consumerGroup, consumerPath } from '../../middleware/consumerGroup';
import {
  consumerAccessRequestPresenter,
  consumerProviderPresenter,
  magicMcpServerPresenter,
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

export let consumerProviderController = Controller.create(
  {
    name: 'Consumer Providers',
    description: 'Browse and configure portal providers from the consumer side.',
    hideInDocs: true
  },
  {
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
          consumerSurfaceOid: ctx.consumerSurface.oid,
          consumerProfileOid: ctx.consumerProfile.oid,
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
          consumerProfileOid: ctx.consumerProfile.oid,
          providerTemplateOid: consumerProvider.providerTemplate.oid,
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
