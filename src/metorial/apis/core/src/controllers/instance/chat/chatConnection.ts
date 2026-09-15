import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { chatConnectionService } from '@metorial-subspace/module-chat';
import { chatConnectionPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

let chatConnectionProviderInputValidator = v.object({
  provider_id: v.string({
    name: 'provider_id',
    description: 'The chat provider to link this connection to',
    examples: ['pro_3cDeFgHjKlMnPqRs']
  }),
  provider_deployment_id: v.optional(
    v.string({
      name: 'provider_deployment_id',
      description: 'Provider deployment to use for this connection'
    })
  ),
  provider_auth_method_id: v.optional(
    v.nullable(
      v.string({
        name: 'provider_auth_method_id',
        description: 'Auth method to use for this connection'
      })
    )
  ),
  provider_auth_credentials_id: v.optional(
    v.nullable(
      v.string({
        name: 'provider_auth_credentials_id',
        description: 'Auth credentials to use for this connection'
      })
    )
  ),
  provider_config_id: v.optional(
    v.nullable(
      v.string({
        name: 'provider_config_id',
        description: 'Provider config to use for this connection'
      })
    )
  ),
  name: v.optional(
    v.string({ name: 'name', description: 'Display name of the provider link' })
  ),
  description: v.optional(
    v.string({ name: 'description', description: 'Description of the provider link' })
  ),
  metadata: v.optional(
    v.record(v.any(), { name: 'metadata', description: 'Metadata set on the provider link' })
  )
});

let chatConnectionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.chatConnectionId) {
    throw new ServiceError(
      badRequestError({
        message: 'chatConnectionId is required',
        description: 'The chatConnectionId path parameter is required.'
      })
    );
  }

  let chatConnection = await chatConnectionService.getChatConnectionById({
    instance: ctx.instance,
    chatConnectionId: ctx.params.chatConnectionId,
    allowDeleted: true
  });

  return { chatConnection };
});

export let chatConnectionController = Controller.create(
  {
    name: 'Chat Connections',
    description:
      'Chat connections link a chat provider, such as Slack or Microsoft Teams, to your instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('chat/connections', 'chat.connections.list'), {
        name: 'List chat connections',
        description: 'Returns a paginated list of chat connections.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .outputList(chatConnectionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string(), { description: 'Search by name' }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              { description: 'Filter by status' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by chat connection ID(s)'
            }),
            created_at: dateFilterValidator('chat connection creation time'),
            updated_at: dateFilterValidator('chat connection last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await chatConnectionService.listChatConnections({
          instance: ctx.instance,
          search: ctx.query.search,
          allowDeleted: true,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, chatConnection =>
          chatConnectionPresenter.present({ chatConnection })
        );
      }),

    get: chatConnectionGroup
      .get(instancePath('chat/connections/:chatConnectionId', 'chat.connections.get'), {
        name: 'Get chat connection',
        description: 'Retrieves a specific chat connection.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .output(chatConnectionPresenter)
      .do(async ctx =>
        chatConnectionPresenter.present({ chatConnection: ctx.chatConnection })
      ),

    create: instanceGroup
      .post(instancePath('chat/connections', 'chat.connections.create'), {
        name: 'Create chat connection',
        description:
          'Creates a new chat connection, together with the single provider it is linked to.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({
            name: 'name',
            description: 'Display name of the chat connection'
          }),
          description: v.optional(v.string({ description: 'Description of the connection' })),
          metadata: v.optional(
            v.record(v.any(), { description: 'Metadata for the connection' })
          ),
          private_metadata: v.optional(
            v.record(v.any(), { description: 'Private metadata for the connection' })
          ),
          provider: chatConnectionProviderInputValidator
        })
      )
      .output(chatConnectionPresenter)
      .do(async ctx => {
        let providerInput = {
          providerId: ctx.body.provider.provider_id,
          providerDeploymentId: ctx.body.provider.provider_deployment_id,
          providerAuthMethodId: ctx.body.provider.provider_auth_method_id,
          providerAuthCredentialsId: ctx.body.provider.provider_auth_credentials_id,
          providerConfigId: ctx.body.provider.provider_config_id,
          name: ctx.body.provider.name,
          description: ctx.body.provider.description,
          metadata: ctx.body.provider.metadata
        };

        let chatConnection = await chatConnectionService.createChatConnectionWithProvider({
          instance: ctx.instance,
          mode: 'standalone',
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            privateMetadata: ctx.body.private_metadata
          },
          provider: providerInput
        });

        return chatConnectionPresenter.present({ chatConnection });
      }),

    update: chatConnectionGroup
      .patch(instancePath('chat/connections/:chatConnectionId', 'chat.connections.update'), {
        name: 'Update chat connection',
        description: 'Updates a specific chat connection.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ description: 'Display name of the chat connection' })),
          description: v.optional(
            v.nullable(v.string({ description: 'Description of the connection' }))
          ),
          metadata: v.optional(v.nullable(v.record(v.any(), { description: 'Metadata' }))),
          private_metadata: v.optional(
            v.nullable(v.record(v.any(), { description: 'Private metadata' }))
          )
        })
      )
      .output(chatConnectionPresenter)
      .do(async ctx => {
        let chatConnection = await chatConnectionService.updateChatConnection({
          instance: ctx.instance,
          chatConnection: ctx.chatConnection,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            privateMetadata: ctx.body.private_metadata
          }
        });

        return chatConnectionPresenter.present({ chatConnection });
      }),

    delete: chatConnectionGroup
      .delete(instancePath('chat/connections/:chatConnectionId', 'chat.connections.delete'), {
        name: 'Delete chat connection',
        description: 'Archives a specific chat connection.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:write'] }))
      .output(chatConnectionPresenter)
      .do(async ctx => {
        let chatConnection = await chatConnectionService.deleteChatConnection({
          instance: ctx.instance,
          chatConnection: ctx.chatConnection
        });

        return chatConnectionPresenter.present({ chatConnection });
      })
  }
);
