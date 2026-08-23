import { Service } from '@lowerdeck/service';
import {
  type ChatIntegrationInstanceProvider,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { chatAdapterService } from '../internal/chatAdapter';
import { chatAuthorServiceInternal } from '../internal/chatAuthor';
import { chatWorkspaceInternalService } from '../internal/chatWorkspace';
import { assertChatCapability } from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';

export type GetAuthenticatedChatUserParams = {
  chatIntegrationInstanceProvider: ChatIntegrationInstanceProvider;
};

class chatUserServiceImpl {
  async getAuthenticatedChatUser(d: MetorialFacing<GetAuthenticatedChatUserParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getAuthenticatedChatUserInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getAuthenticatedChatUserInternal(
    d: { tenant: Tenant; environment: Environment } & GetAuthenticatedChatUserParams
  ) {
    checkTenant(d, d.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chatIntegrationInstanceProvider
    });

    assertChatCapability(client, 'user_self_read', {
      message: 'This chat provider does not support fetching the authenticated user.'
    });

    let got = await client.call('metorial_chat$user.getAuthenticated', {});
    let result = unwrapChatCall(got, {
      code: 'chat_user_get_authenticated_failed',
      message: 'Failed to load the authenticated user from the chat provider.'
    });

    let upsertedWorkspace = result.workspace
      ? await chatWorkspaceInternalService.upsertChatWorkspace({
          chatIntegrationInstanceProvider: d.chatIntegrationInstanceProvider,
          workspace: result.workspace
        })
      : null;

    let author = upsertedWorkspace
      ? (
          await chatAuthorServiceInternal.upsertChatAuthors({
            chat: upsertedWorkspace.chat,
            authors: [result.author]
          })
        )[0]!
      : result.author;

    return { author, workspace: upsertedWorkspace?.workspace ?? null };
  }
}

export let chatUserService = Service.create(
  'chatUserService',
  () => new chatUserServiceImpl()
).build();
