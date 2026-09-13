import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { chatInstanceService, chatWorkspaceService } from '@metorial-subspace/module-chat';
import { chatWorkspacePresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { resolveSoleChatInstanceProvider } from './_shared';

export let chatWorkspaceController = Controller.create(
  {
    name: 'Chat Workspaces',
    description:
      'Chat workspaces group channels together, for chat providers that organize conversations that way.'
  },
  {
    list: instanceGroup
      .get(instancePath('chat/workspaces', 'chat.workspaces.list'), {
        name: 'List chat workspaces',
        description: 'Returns a paginated list of workspaces for a chat instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .outputList(chatWorkspacePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            chat_instance_id: v.string({
              name: 'chat_instance_id',
              description: 'The chat instance to list workspaces for',
              examples: ['cii_2bCdEfGhJkLmNpQr']
            }),
            search: v.optional(v.string({ description: 'Search by workspace name' }))
          })
        )
      )
      .do(async ctx => {
        let chatInstance = await chatInstanceService.getChatInstanceById({
          instance: ctx.instance,
          chatInstanceId: ctx.query.chat_instance_id
        });
        let chatInstanceProvider = await resolveSoleChatInstanceProvider(
          ctx.instance,
          chatInstance.id
        );

        let paginator = await chatWorkspaceService.listChatWorkspaces({
          instance: ctx.instance,
          chatInstanceProvider,
          search: ctx.query.search
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, chatWorkspace =>
          chatWorkspacePresenter.present({ chatWorkspace })
        );
      }),

    get: instanceGroup
      .get(instancePath('chat/workspaces/:chatWorkspaceId', 'chat.workspaces.get'), {
        name: 'Get chat workspace',
        description: 'Retrieves a specific chat workspace.'
      })
      .use(checkAccess({ possibleScopes: ['instance.chat:read'] }))
      .query(
        'default',
        v.object({
          chat_instance_id: v.string({
            name: 'chat_instance_id',
            description: 'The chat instance this workspace belongs to',
            examples: ['cii_2bCdEfGhJkLmNpQr']
          })
        })
      )
      .output(chatWorkspacePresenter)
      .do(async ctx => {
        if (!ctx.params.chatWorkspaceId) {
          throw new ServiceError(
            badRequestError({
              message: 'chatWorkspaceId is required',
              description: 'The chatWorkspaceId path parameter is required.'
            })
          );
        }

        let chatInstance = await chatInstanceService.getChatInstanceById({
          instance: ctx.instance,
          chatInstanceId: ctx.query.chat_instance_id
        });
        let chatInstanceProvider = await resolveSoleChatInstanceProvider(
          ctx.instance,
          chatInstance.id
        );

        let chatWorkspace = await chatWorkspaceService.getChatWorkspace({
          instance: ctx.instance,
          chatInstanceProvider,
          workspaceId: ctx.params.chatWorkspaceId
        });

        return chatWorkspacePresenter.present({ chatWorkspace });
      })
  }
);
