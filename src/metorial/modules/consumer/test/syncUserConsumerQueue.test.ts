import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    instanceConsumer: { findMany: vi.fn(), findFirst: vi.fn() }
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => handler)
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('../src/services', () => ({
  consumerService: { updateConsumer: vi.fn() }
}));

vi.mock('../src/queues/reconcileUserConsumer', () => ({
  reconcileUserConsumersQueue: { add: vi.fn() }
}));

describe('sync user consumer queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('discovers consumers linked directly or through an organization member', async () => {
    let { db } = await import('@metorial/db');
    let { syncUserConsumerQueue, syncUserConsumersQueueProcessor } =
      await import('../src/queues/syncUserConsumer');

    (db.user.findUnique as any).mockResolvedValue({
      oid: 42n,
      name: 'Updated User',
      email: 'updated@example.com',
      type: 'user'
    });
    (db.instanceConsumer.findMany as any).mockResolvedValue([
      { id: 'cns_1' },
      { id: 'cns_2' }
    ]);

    await (syncUserConsumersQueueProcessor as any)({ userId: 'user_123' });

    expect(db.instanceConsumer.findMany).toHaveBeenCalledWith({
      where: {
        id: { gt: undefined },
        consumer: {
          OR: [{ userOid: 42n }, { organizationMember: { userOid: 42n } }]
        }
      },
      orderBy: { id: 'asc' },
      take: 100
    });
    expect(syncUserConsumerQueue.addMany).toHaveBeenCalledWith([
      { userId: 'user_123', instanceConsumerId: 'cns_1' },
      { userId: 'user_123', instanceConsumerId: 'cns_2' }
    ]);
  });

  it('updates an eligible instance consumer through the consumer lifecycle', async () => {
    let { db } = await import('@metorial/db');
    let { consumerService } = await import('../src/services');
    let { syncUserConsumerQueueProcessor } = await import('../src/queues/syncUserConsumer');

    (db.user.findUnique as any).mockResolvedValue({
      oid: 42n,
      name: 'Updated User',
      email: 'updated@example.com',
      type: 'user'
    });
    (db.instanceConsumer.findFirst as any).mockResolvedValue({
      id: 'cns_1',
      email: 'previous@example.com'
    });

    await (syncUserConsumerQueueProcessor as any)({
      userId: 'user_123',
      instanceConsumerId: 'cns_1'
    });

    expect(consumerService.updateConsumer).toHaveBeenCalledWith({
      consumer: { id: 'cns_1', email: 'previous@example.com' },
      input: { name: 'Updated User', email: 'updated@example.com' }
    });
  });
});
