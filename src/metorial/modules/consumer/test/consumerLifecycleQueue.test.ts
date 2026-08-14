import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    consumer: { findFirst: vi.fn() },
    instanceConsumer: { findUniqueOrThrow: vi.fn() }
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    process: vi.fn(handler => handler)
  }))
}));

vi.mock('../src/queues/search/consumer', () => ({
  indexConsumerSearchQueue: { add: vi.fn() }
}));

vi.mock('../src/queues/syncIdentityConsumer', () => ({
  syncIdentityConsumerQueue: { add: vi.fn() }
}));

vi.mock('../src/queues/lifecycle/pendingStatus', () => ({
  syncPendingStatusForInstanceConsumer: vi.fn()
}));

describe('consumer lifecycle queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('notifies listeners when a newly linked consumer is queued directly', async () => {
    let { db } = await import('@metorial/db');
    let { Fabric } = await import('@metorial/fabric');
    let { consumerUpdatedQueueProcessor } = await import('../src/queues/lifecycle/consumer');
    let consumer = { id: 'consumer_123', userOid: 42n };

    vi.mocked(db.consumer.findFirst).mockResolvedValue(consumer as any);

    await (consumerUpdatedQueueProcessor as any)({ consumerId: consumer.id });

    expect(db.consumer.findFirst).toHaveBeenCalledWith({
      where: { id: consumer.id }
    });
    expect(Fabric.fire).toHaveBeenCalledWith('consumer.updated:after', { consumer });
  });

  it('notifies listeners after a regular instance consumer update', async () => {
    let { db } = await import('@metorial/db');
    let { Fabric } = await import('@metorial/fabric');
    let { consumerUpdatedQueueProcessor } = await import('../src/queues/lifecycle/consumer');
    let consumer = { id: 'consumer_123', userOid: 42n };

    vi.mocked(db.consumer.findFirst).mockResolvedValue(consumer as any);

    await (consumerUpdatedQueueProcessor as any)({
      instanceConsumerId: 'instance_consumer_123'
    });

    expect(db.consumer.findFirst).toHaveBeenCalledWith({
      where: {
        instanceConsumers: { some: { id: 'instance_consumer_123' } }
      }
    });
    expect(Fabric.fire).toHaveBeenCalledWith('consumer.updated:after', { consumer });
  });

  it('notifies listeners after a new consumer has committed and reconciled pending state', async () => {
    let { db } = await import('@metorial/db');
    let { Fabric } = await import('@metorial/fabric');
    let { syncPendingStatusForInstanceConsumer } =
      await import('../src/queues/lifecycle/pendingStatus');
    let { consumerCreatedQueueProcessor } = await import('../src/queues/lifecycle/consumer');
    let consumer = { id: 'consumer_123' };
    let instanceConsumer = {
      id: 'instance_consumer_123',
      consumer
    };
    vi.mocked(db.instanceConsumer.findUniqueOrThrow).mockResolvedValue(
      instanceConsumer as any
    );

    await (consumerCreatedQueueProcessor as any)({
      instanceConsumerId: instanceConsumer.id
    });

    expect(syncPendingStatusForInstanceConsumer).toHaveBeenCalledWith(instanceConsumer.id);
    expect(db.instanceConsumer.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: instanceConsumer.id },
      include: { consumer: true }
    });
    expect(Fabric.fire).toHaveBeenCalledWith('consumer.created:after', {
      consumer,
      instanceConsumer
    });
  });
});
