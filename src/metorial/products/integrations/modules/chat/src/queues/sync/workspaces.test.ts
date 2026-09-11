import { chatError } from '@slates/adapter-chat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, queues, getChatAdapterClientInternal, upsertChatWorkspaces } = vi.hoisted(() => {
  let queues: Record<
    string,
    { add: ReturnType<typeof vi.fn>; addMany: ReturnType<typeof vi.fn> }
  > = {};

  return {
    db: {
      chatIntegrationInstanceProvider: {
        findMany: vi.fn(),
        findUnique: vi.fn()
      }
    },
    queues,
    getChatAdapterClientInternal: vi.fn(),
    upsertChatWorkspaces: vi.fn()
  };
});

vi.mock('@lowerdeck/cron', () => ({
  createCron: vi.fn(() => ({}))
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn((opts: { name: string }) => {
    let q = queues[opts.name] ?? {
      add: vi.fn(),
      addMany: vi.fn()
    };
    queues[opts.name] = q;
    return {
      ...q,
      process: (fn: any) => fn
    };
  }),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost' } }
}));

vi.mock('@metorial-subspace/db', () => ({
  db,
  addAfterTransactionHook: async (hook: () => any) => await hook()
}));

vi.mock('../../internal/chatAdapter', () => ({
  chatAdapterService: {
    getChatAdapterClientInternal
  },
  chatAdapterWorkerClient: { identifier: 'worker', name: 'Worker' }
}));

vi.mock('../../internal/chatWorkspace', () => ({
  chatWorkspaceInternalService: {
    upsertChatWorkspaces
  }
}));

import {
  syncChatWorkspacesForProviderQueueProcessor,
  syncChatWorkspacesManyQueueProcessor
} from './workspaces';

type JobHandler<T> = (data: T) => Promise<void>;

let processSyncChatWorkspacesMany =
  syncChatWorkspacesManyQueueProcessor as unknown as JobHandler<{
    cursor?: string;
  }>;
let processSyncChatWorkspacesForProvider =
  syncChatWorkspacesForProviderQueueProcessor as unknown as JobHandler<{
    chatIntegrationInstanceProviderId: string;
    cursor?: string;
  }>;

let manyQueue = 'sub/cht/sync/workspaces/many';
let providerQueue = 'sub/cht/sync/workspaces/provider';

let mockActiveProvider = () => {
  db.chatIntegrationInstanceProvider.findUnique.mockResolvedValue({
    id: 'ciip_1',
    oid: 80n,
    status: 'active',
    isParentDeleted: false,
    chatIntegrationInstance: { oid: 20n, status: 'active' },
    tenant: { oid: 1n },
    environment: { oid: 3n }
  });
};

let mockAdapterFailure = (error: unknown) => {
  getChatAdapterClientInternal.mockResolvedValue({
    isCapabilityAvailable: () => true,
    call: vi.fn(async () => ({
      result: { type: 'failure', output: JSON.parse(JSON.stringify(error)) }
    }))
  });
};

describe('sync chat workspace queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fans out active instance providers and self-enqueues with a cursor', async () => {
    db.chatIntegrationInstanceProvider.findMany.mockResolvedValue([
      { id: 'ciip_1' },
      { id: 'ciip_2' }
    ]);

    await processSyncChatWorkspacesMany({});

    expect(queues[providerQueue]!.addMany).toHaveBeenCalledWith([
      { chatIntegrationInstanceProviderId: 'ciip_1' },
      { chatIntegrationInstanceProviderId: 'ciip_2' }
    ]);
    expect(queues[manyQueue]!.add).toHaveBeenCalledWith({ cursor: 'ciip_2' });
  });

  it('lists workspaces from the adapter and upserts the page', async () => {
    let chatIntegrationInstanceProvider = {
      id: 'ciip_1',
      oid: 80n,
      status: 'active',
      isParentDeleted: false,
      chatIntegrationInstance: { oid: 20n, status: 'active' },
      tenant: { oid: 1n },
      environment: { oid: 3n }
    };
    db.chatIntegrationInstanceProvider.findUnique.mockResolvedValue(
      chatIntegrationInstanceProvider
    );

    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => true,
      call: vi.fn(async () => ({
        result: {
          type: 'success',
          output: {
            workspaces: [{ id: 'T123', name: 'Acme' }],
            nextCursor: 'cursor-2'
          }
        }
      }))
    });

    await processSyncChatWorkspacesForProvider({
      chatIntegrationInstanceProviderId: 'ciip_1'
    });

    expect(upsertChatWorkspaces).toHaveBeenCalledWith({
      chatIntegrationInstanceProvider,
      workspaces: [{ id: 'T123', name: 'Acme' }]
    });
    expect(queues[providerQueue]!.add).toHaveBeenCalledWith({
      chatIntegrationInstanceProviderId: 'ciip_1',
      cursor: 'cursor-2'
    });
  });

  it('retries a transient adapter failure', async () => {
    mockActiveProvider();
    mockAdapterFailure(chatError('chat.rate_limit.exceeded'));

    await expect(
      processSyncChatWorkspacesForProvider({ chatIntegrationInstanceProviderId: 'ciip_1' })
    ).rejects.toBeInstanceOf(Error);

    expect(upsertChatWorkspaces).not.toHaveBeenCalled();
  });

  it('gives up on a terminal adapter failure instead of retrying', async () => {
    mockActiveProvider();
    mockAdapterFailure(chatError('chat.auth.missing_scope'));

    // A revoked token or a missing scope used to throw QueueRetryError like
    // everything else, burning every attempt before going to the dead letter
    // queue without ever saying why.
    await expect(
      processSyncChatWorkspacesForProvider({ chatIntegrationInstanceProviderId: 'ciip_1' })
    ).resolves.toBeUndefined();

    expect(upsertChatWorkspaces).not.toHaveBeenCalled();
    expect(queues[providerQueue]!.add).not.toHaveBeenCalled();
  });

  it('retries an unclassified failure conservatively', async () => {
    mockActiveProvider();
    mockAdapterFailure({ code: 'timeout', message: 'timed out' });

    // A transport level failure carries no chat classification, and it is the
    // most transient kind there is — treating "unclassified" as terminal would
    // stop retrying exactly the failures that most deserve it.
    await expect(
      processSyncChatWorkspacesForProvider({ chatIntegrationInstanceProviderId: 'ciip_1' })
    ).rejects.toBeInstanceOf(Error);
  });

  it('skips providers that do not advertise workspace_read', async () => {
    db.chatIntegrationInstanceProvider.findUnique.mockResolvedValue({
      id: 'ciip_1',
      oid: 80n,
      status: 'active',
      isParentDeleted: false,
      chatIntegrationInstance: { oid: 20n, status: 'active' },
      tenant: { oid: 1n },
      environment: { oid: 3n }
    });
    getChatAdapterClientInternal.mockResolvedValue({
      isCapabilityAvailable: () => false,
      call: vi.fn()
    });

    await processSyncChatWorkspacesForProvider({
      chatIntegrationInstanceProviderId: 'ciip_1'
    });

    expect(upsertChatWorkspaces).not.toHaveBeenCalled();
  });
});
