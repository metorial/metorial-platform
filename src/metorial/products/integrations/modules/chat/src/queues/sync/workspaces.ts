import { createCron } from '@lowerdeck/cron';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { env } from '../../env';
import { chatAdapterService } from '../../internal/chatAdapter';
import { chatWorkspaceInternalService } from '../../internal/chatWorkspace';
import { describeChatFailure, shouldRetryChatCall } from '../../lib/chatError';

export let syncChatWorkspacesCron = createCron(
  {
    name: 'sub/cht/cron/syncWorkspaces',
    cron: '0 */12 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await syncChatWorkspacesManyQueue.add({}, { id: 'many' });
  }
);

export let syncChatWorkspacesManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/cht/sync/workspaces/many',
  redisUrl: env.service.REDIS_URL
});

export let syncChatWorkspacesManyQueueProcessor = syncChatWorkspacesManyQueue.process(
  async data => {
    let providers = await db.chatInstanceProvider.findMany({
      where: {
        status: 'active',
        isParentDeleted: false,
        chatInstance: { status: 'active' },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (providers.length === 0) return;

    await syncChatWorkspacesForProviderQueue.addMany(
      providers.map(provider => ({
        chatInstanceProviderId: provider.id
      }))
    );

    let lastProvider = providers[providers.length - 1];
    if (!lastProvider) return;

    await syncChatWorkspacesManyQueue.add({
      cursor: lastProvider.id
    });
  }
);

export let syncChatWorkspacesForProviderQueue = createQueue<{
  chatInstanceProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cht/sync/workspaces/provider',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let enqueueSyncChatWorkspacesForProvider = (chatInstanceProviderId: string) =>
  addAfterTransactionHook(async () => {
    await syncChatWorkspacesForProviderQueue.add(
      { chatInstanceProviderId },
      { id: `ws-sync-${chatInstanceProviderId}` }
    );
  });

export let syncChatWorkspacesForProviderQueueProcessor =
  syncChatWorkspacesForProviderQueue.process(async data => {
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

    if (!client.isCapabilityAvailable('workspace_read')) return;

    let listed = await client.call('metorial_chat$workspace.list', {
      cursor: data.cursor,
      limit: 50,
      direction: 'forward'
    });
    if (listed.result.type === 'failure') {
      let failure = describeChatFailure(listed.result.output);

      if (!shouldRetryChatCall(listed.result.output)) {
        console.warn(
          `CHAT.sync.workspaces.terminal providerId=${data.chatInstanceProviderId} code=${failure.code} providerCode=${failure.providerCode ?? 'none'}`
        );
        return;
      }

      throw new QueueRetryError();
    }

    let workspaces = listed.result.output.workspaces;
    if (workspaces.length === 0) return;

    await chatWorkspaceInternalService.upsertChatWorkspaces({
      chatInstanceProvider,
      workspaces
    });

    if (listed.result.output.nextCursor) {
      await syncChatWorkspacesForProviderQueue.add({
        chatInstanceProviderId: data.chatInstanceProviderId,
        cursor: listed.result.output.nextCursor
      });
    }
  });
