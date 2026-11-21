import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  chatConnectionService,
  chatInstanceProviderService,
  chatInstanceService,
  chatService,
  chatUserService
} from '@metorial-subspace/module-chat';
import {
  chatAuthenticatedUserPresenter,
  chatInstancePresenter,
  chatInstanceProviderPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { resolveSoleChatInstanceProvider } from './_shared';

let chatInstanceGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.chatInstanceId) {
    throw new ServiceError(
      badRequestError({
        message: 'chatInstanceId is required',
        description: 'The chatInstanceId path parameter is required.'
      })
    );
  }

  let chatInstance = await chatInstanceService.getChatInstanceById({
    instance: ctx.instance,
    chatInstanceId: ctx.params.chatInstanceId,
    allowDeleted: true
  });

  return { chatInstance };
});

export let chatInstanceController = Controller.create(
  {
    name: 'Chat Instances',
    description:
      'A chat instance is a chat connection running with its own configuration and identity.'
  },
  {
    list: instanceGroup
      .get(instancePath('chat/instances', 'chat.instances.list'), {
        name: 'List chat instances',
        description: 'Returns a paginated list of chat instances.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .outputList(chatInstancePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string(), { description: 'Search by name' }),
            status: v.optional(
              v.union([
                v.enumOf(['draft', 'active', 'archived', 'deleted']),
                v.array(v.enumOf(['draft', 'active', 'archived', 'deleted']))
              ]),
              { description: 'Only return chat instances with one of these statuses.' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return chat instances with one of these IDs.'
            }),
            chat_connection_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return chat instances for one of these chat connections.'
            }),
            created_at: dateFilterValidator('chat instance creation time'),
            updated_at: dateFilterValidator('chat instance last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await chatInstanceService.listChatInstances({
          instance: ctx.instance,
          search: ctx.query.search,
          allowDeleted: false,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          chatConnectionIds: normalizeArrayParam(ctx.query.chat_connection_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, chatInstance =>
          chatInstancePresenter.present({ chatInstance })
        );
      }),

    get: chatInstanceGroup
      .get(instancePath('chat/instances/:chatInstanceId', 'chat.instances.get'), {
        name: 'Get chat instance',
        description: 'Retrieves a chat instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .output(chatInstancePresenter)
      .do(async ctx => chatInstancePresenter.present({ chatInstance: ctx.chatInstance })),

    create: instanceGroup
      .post(instancePath('chat/instances', 'chat.instances.create'), {
        name: 'Create chat instance',
        description: 'Creates a new chat instance for a chat connection.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body(
        'default',
        v.object({
          chat_connection_id: v.string({
            name: 'chat_connection_id',
            description: 'Chat connection to create this instance for.'
          }),
          name: v.optional(v.string({ description: 'Display name.' })),
          description: v.optional(v.string({ description: 'Free-text description.' })),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom data to identify or organize the chat instance.'
            })
          ),
          private_metadata: v.optional(
            v.record(v.any(), {
              description: 'Private data stored with the instance. Never returned by the API.'
            })
          ),
          identity_actor_id: v.optional(
            v.nullable(v.string({ description: 'Identity actor to run this instance as' }))
          ),
          identity_id: v.optional(
            v.nullable(v.string({ description: 'Identity to run this instance as' }))
          )
        })
      )
      .output(chatInstancePresenter)
      .do(async ctx => {
        let chatConnection = await chatConnectionService.getChatConnectionById({
          instance: ctx.instance,
          chatConnectionId: ctx.body.chat_connection_id
        });

        let chatInstance = await chatInstanceService.createChatInstance({
          instance: ctx.instance,
          chatConnection,
          createStandaloneInstance: {
            name: ctx.body.name,
            identity:
              ctx.body.identity_actor_id || ctx.body.identity_id
                ? {
                    identityActorId: ctx.body.identity_actor_id,
                    identityId: ctx.body.identity_id
                  }
                : undefined
          },
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            privateMetadata: ctx.body.private_metadata
          }
        });

        return chatInstancePresenter.present({ chatInstance });
      }),

    update: chatInstanceGroup
      .patch(instancePath('chat/instances/:chatInstanceId', 'chat.instances.update'), {
        name: 'Update chat instance',
        description: 'Updates a chat instance. Omitted fields keep their current value.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ description: 'Display name.' })),
          description: v.optional(
            v.nullable(v.string({ description: 'Free-text description. `null` clears it.' }))
          ),
          metadata: v.optional(
            v.nullable(
              v.record(v.any(), {
                description:
                  'Custom data to identify or organize the chat instance. Replaces existing metadata.'
              })
            )
          ),
          private_metadata: v.optional(
            v.nullable(
              v.record(v.any(), {
                description: 'Private data stored with the instance. Never returned by the API.'
              })
            )
          )
        })
      )
      .output(chatInstancePresenter)
      .do(async ctx => {
        let chatInstance = await chatInstanceService.updateChatInstance({
          instance: ctx.instance,
          chatInstance: ctx.chatInstance,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            privateMetadata: ctx.body.private_metadata
          }
        });

        return chatInstancePresenter.present({ chatInstance });
      }),

    delete: chatInstanceGroup
      .delete(instancePath('chat/instances/:chatInstanceId', 'chat.instances.delete'), {
        name: 'Archive chat instance',
        description: 'Archives a chat instance. It stays listable with `status=archived`.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .output(chatInstancePresenter)
      .do(async ctx => {
        let chatInstance = await chatInstanceService.deleteChatInstance({
          instance: ctx.instance,
          chatInstance: ctx.chatInstance
        });

        return chatInstancePresenter.present({ chatInstance });
      }),

    sync: chatInstanceGroup
      .post(instancePath('chat/instances/:chatInstanceId/sync', 'chat.instances.sync'), {
        name: 'Sync chat instance',
        description: 'Triggers a sync of the workspaces available on this chat instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .output(chatInstancePresenter)
      .do(async ctx => {
        await chatService.syncChats({
          instance: ctx.instance,
          chatInstance: ctx.chatInstance
        });

        return chatInstancePresenter.present({ chatInstance: ctx.chatInstance });
      }),

    getProvider: chatInstanceGroup
      .get(
        instancePath('chat/instances/:chatInstanceId/provider', 'chat.instances.provider.get'),
        {
          name: 'Get chat instance provider',
          description: 'Retrieves the single provider configured for a chat instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .output(chatInstanceProviderPresenter)
      .do(async ctx => {
        let chatInstanceProvider = await resolveSoleChatInstanceProvider(
          ctx.instance,
          ctx.chatInstance.id
        );

        return chatInstanceProviderPresenter.present({ chatInstanceProvider });
      }),

    setProvider: chatInstanceGroup
      .patch(
        instancePath('chat/instances/:chatInstanceId/provider', 'chat.instances.provider.set'),
        {
          name: 'Set chat instance provider',
          description: 'Creates or updates the single provider for a chat instance.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body(
        'default',
        v.object({
          provider_id: v.string({
            name: 'provider_id',
            description: 'Chat provider to use for this instance.'
          }),
          provider_deployment_id: v.optional(
            v.string({ description: 'Provider deployment to use' })
          ),
          provider_config_id: v.optional(
            v.nullable(v.string({ description: 'Provider config to use' }))
          ),
          provider_auth_config_id: v.optional(
            v.nullable(v.string({ description: 'Provider auth config to use' }))
          )
        })
      )
      .output(chatInstanceProviderPresenter)
      .do(async ctx => {
        let providers = await chatInstanceProviderService.setChatInstanceProvider({
          instance: ctx.instance,
          chatInstance: ctx.chatInstance,
          input: {
            providerId: ctx.body.provider_id,
            providerDeploymentId: ctx.body.provider_deployment_id,
            providerConfigId: ctx.body.provider_config_id,
            providerAuthConfigId: ctx.body.provider_auth_config_id ?? undefined
          }
        });

        let chatInstanceProvider = providers[0];
        if (!chatInstanceProvider) {
          throw new ServiceError(notFoundError('chat.instance.provider', ctx.chatInstance.id));
        }

        return chatInstanceProviderPresenter.present({ chatInstanceProvider });
      }),

    getAuthenticatedUser: chatInstanceGroup
      .get(
        instancePath(
          'chat/instances/:chatInstanceId/provider/authenticated-user',
          'chat.instances.provider.authenticatedUser'
        ),
        {
          name: 'Get chat instance authenticated user',
          description:
            'Retrieves the chat provider account this chat instance is authenticated as.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .output(chatAuthenticatedUserPresenter)
      .do(async ctx => {
        let chatInstanceProvider = await resolveSoleChatInstanceProvider(
          ctx.instance,
          ctx.chatInstance.id
        );

        let result = await chatUserService.getAuthenticatedChatUser({
          instance: ctx.instance,
          chatInstanceProvider
        });

        return chatAuthenticatedUserPresenter.present({
          author: result.author,
          workspace: result.workspace
        });
      })
  }
);
