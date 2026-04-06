import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueRetryError } from '@metorial/queue';

vi.mock('@metorial/db', () => ({
  db: {
    apiKey: {
      findUnique: vi.fn()
    },
    organization: {
      findUnique: vi.fn()
    },
    organizationMember: {
      findMany: vi.fn(),
      findFirst: vi.fn()
    }
  }
}));

vi.mock('./../src/queues/created/sendApiKeyCreatedEmailToMember', () => ({
  sendApiKeyCreatedEmailToMemberQueue: {
    addMany: vi.fn()
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => handler)
  })),
  QueueRetryError: class QueueRetryError extends Error {
    constructor(message?: string) {
      super(message || 'Queue retry error');
      this.name = 'QueueRetryError';
    }
  }
}));

describe('sendApiKeyCreatedEmailQueueProcessor', () => {
  let db: any;
  let sendApiKeyCreatedEmailToMemberQueue: any;
  let sendApiKeyCreatedEmailQueueProcessor: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    db = (await import('@metorial/db')).db;
    sendApiKeyCreatedEmailToMemberQueue = (
      await import('./../src/queues/created/sendApiKeyCreatedEmailToMember')
    ).sendApiKeyCreatedEmailToMemberQueue;
    sendApiKeyCreatedEmailQueueProcessor = (
      await import('./../src/queues/created/sendApiKeyCreatedEmail')
    ).sendApiKeyCreatedEmailQueueProcessor;
  });

  it('enqueues one job per unique member, including the creator when they are not already an admin', async () => {
    db.apiKey.findUnique.mockResolvedValue({
      id: 'api-key-id',
      machineAccess: {
        organizationOid: 1n
      }
    });
    db.organization.findUnique.mockResolvedValue({
      id: 'org-id',
      oid: 1n
    });
    db.organizationMember.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);
    db.organizationMember.findFirst.mockResolvedValue({ id: 'creator-member' });

    await sendApiKeyCreatedEmailQueueProcessor({
      apiKeyId: 'api-key-id',
      organizationId: 'org-id',
      performedByActorId: 'actor-id'
    });

    expect(sendApiKeyCreatedEmailToMemberQueue.addMany).toHaveBeenCalledWith([
      {
        apiKeyId: 'api-key-id',
        organizationId: 'org-id',
        memberId: 'admin-1',
        performedByActorId: 'actor-id'
      },
      {
        apiKeyId: 'api-key-id',
        organizationId: 'org-id',
        memberId: 'admin-2',
        performedByActorId: 'actor-id'
      },
      {
        apiKeyId: 'api-key-id',
        organizationId: 'org-id',
        memberId: 'creator-member',
        performedByActorId: 'actor-id'
      }
    ]);
  });

  it('deduplicates the creator when they are already an admin', async () => {
    db.apiKey.findUnique.mockResolvedValue({
      id: 'api-key-id',
      machineAccess: {
        organizationOid: 1n
      }
    });
    db.organization.findUnique.mockResolvedValue({
      id: 'org-id',
      oid: 1n
    });
    db.organizationMember.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    db.organizationMember.findFirst.mockResolvedValue({ id: 'admin-1' });

    await sendApiKeyCreatedEmailQueueProcessor({
      apiKeyId: 'api-key-id',
      organizationId: 'org-id',
      performedByActorId: 'actor-id'
    });

    expect(sendApiKeyCreatedEmailToMemberQueue.addMany).toHaveBeenCalledWith([
      {
        apiKeyId: 'api-key-id',
        organizationId: 'org-id',
        memberId: 'admin-1',
        performedByActorId: 'actor-id'
      }
    ]);
  });

  it('throws QueueRetryError when the api key does not exist yet', async () => {
    db.apiKey.findUnique.mockResolvedValue(null);

    await expect(
      sendApiKeyCreatedEmailQueueProcessor({
        apiKeyId: 'api-key-id',
        organizationId: 'org-id',
        performedByActorId: 'actor-id'
      })
    ).rejects.toThrow(QueueRetryError);
  });
});
