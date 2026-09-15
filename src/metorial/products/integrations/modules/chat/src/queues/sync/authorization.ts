import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { env } from '../../env';
import { chatAdapterService } from '../../internal/chatAdapter';
import { chatAuthorServiceInternal } from '../../internal/chatAuthor';
import { chatWorkspaceInternalService } from '../../internal/chatWorkspace';
import { describeChatFailure, shouldRetryChatCall } from '../../lib/chatError';

export let syncChatInstanceProviderAuthorizationQueue = createQueue<{
  chatInstanceProviderId: string;
}>({
  name: 'sub/cht/sync/authorization',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let enqueueSyncChatInstanceProviderAuthorization = (chatInstanceProviderId: string) =>
  addAfterTransactionHook(async () => {
    await syncChatInstanceProviderAuthorizationQueue.add(
      { chatInstanceProviderId },
      { id: `auth-sync-${chatInstanceProviderId}` }
    );
  });

export let syncChatInstanceProviderAuthorizationQueueProcessor =
  syncChatInstanceProviderAuthorizationQueue.process(async data => {
    let chatInstanceProvider = await db.chatInstanceProvider.findUnique({
      where: { id: data.chatInstanceProviderId },
      include: {
        chatInstance: true,
        tenant: true,
        environment: true
      }
    });
    if (
      !chatInstanceProvider ||
      chatInstanceProvider.status !== 'active' ||
      chatInstanceProvider.isParentDeleted
    ) {
      return;
    }
    if (chatInstanceProvider.chatInstance.status !== 'active') return;

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: chatInstanceProvider.tenant,
      environment: chatInstanceProvider.environment,
      chatInstanceProvider
    });

    if (!client.isCapabilityAvailable('user_self_read')) return;

    let result = await client.call('metorial_chat$user.getAuthenticated', {});
    if (result.result.type === 'failure') {
      let failure = describeChatFailure(result.result.output);

      if (!shouldRetryChatCall(result.result.output)) {
        console.warn(
          `CHAT.sync.authorization.terminal providerId=${data.chatInstanceProviderId} code=${failure.code} providerCode=${failure.providerCode ?? 'none'}`
        );
        return;
      }

      throw new QueueRetryError();
    }

    let { author, workspace } = result.result.output;

    let resolved = await chatWorkspaceInternalService.resolveChatForAuthorLink({
      chatInstanceProvider,
      workspace
    });
    if (!resolved) return;

    await chatAuthorServiceInternal.upsertChatAuthors({
      chat: resolved.chat,
      authors: [author]
    });
  });
