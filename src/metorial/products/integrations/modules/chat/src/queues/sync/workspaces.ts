import { createCron } from '@lowerdeck/cron';
import { createQueue, dailyPacedDelay, QueueRetryError } from '@lowerdeck/queue';
import { addAfterTransactionHook, db } from '@metorial-subspace/db';
import { env } from '../../env';
import { chatAdapterService } from '../../internal/chatAdapter';
import { chatWorkspaceInternalService } from '../../internal/chatWorkspace';
import { describeChatFailure, shouldRetryChatCall } from '../../lib/chatError';

let SYNC_WORKSPACES_BATCH_SIZE = 500;

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
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let syncChatWorkspacesManyQueueProcessor = syncChatWorkspacesManyQueue.process(
  async job => {
    let providers = await db.chatInstanceProvider.findMany({
      where: {
        status: 'active',
        isParentDeleted: false,
        chatInstance: { status: 'active' },
        id: job.cursor ? { gt: job.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: SYNC_WORKSPACES_BATCH_SIZE,
      select: { id: true }
    });

    if (providers.length) {
      await syncChatWorkspacesForProviderQueue.addManyWithOps(
        providers.map(provider => ({
          data: { chatInstanceProviderId: provider.id },
          opts: { id: `ws-sync-${provider.id}` }
        }))
      );
    }

    if (providers.length === SYNC_WORKSPACES_BATCH_SIZE) {
      await syncChatWorkspacesManyQueue.add(
        { cursor: providers[providers.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  }
);

export let syncChatWorkspacesForProviderQueue = createQueue<{
  chatInstanceProviderId: string;
  cursor?: string;
}>({
  name: 'sub/cht/sync/workspaces/provider',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 5, duration: 1000 } }
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
