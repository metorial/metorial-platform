import { QueueRetryError } from '@metorial/queue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({
  db: {
    outgoingEmail: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((opts) => ({
    process: vi.fn((handler) => handler),
    add: vi.fn(),
    addMany: vi.fn()
  })),
  QueueRetryError: class QueueRetryError extends Error {
    constructor() {
      super('Queue retry error');
      this.name = 'QueueRetryError';
    }
  }
}));

vi.mock('../src/queue/sendEmailSingle', () => ({
  sendEmailSingleQueue: {
    addMany: vi.fn()
  }
}));

describe('sendEmailQueueProcessor', () => {
  let db: any;
  let sendEmailSingleQueue: any;
  let sendEmailQueueProcessor: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    db = (await import('@metorial/db')).db;
    sendEmailSingleQueue = (await import('../src/queue/sendEmailSingle')).sendEmailSingleQueue;

    const queueModule = await import('../src/queue/sendEmail');
    sendEmailQueueProcessor = queueModule.sendEmailQueueProcessor;
  });

  it('should process email and add destinations to single email queue', async () => {
    const mockEmail = {
      id: 'email-123',
      oid: 1n,
      destinations: [
        { id: 1n, destination: 'user1@example.com', status: 'pending' },
        { id: 2n, destination: 'user2@example.com', status: 'pending' },
        { id: 3n, destination: 'user3@example.com', status: 'pending' }
      ]
    };

    db.outgoingEmail.findFirst.mockResolvedValue(mockEmail);
    sendEmailSingleQueue.addMany.mockResolvedValue(undefined);

    await sendEmailQueueProcessor({ emailId: 'email-123' });

    expect(db.outgoingEmail.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'email-123'
      },
      include: {
        destinations: true
      }
    });

    expect(sendEmailSingleQueue.addMany).toHaveBeenCalledWith([
      { destinationId: 1n },
      { destinationId: 2n },
      { destinationId: 3n }
    ]);
  });

  it('should throw QueueRetryError when email is not found', async () => {
    db.outgoingEmail.findFirst.mockResolvedValue(null);

    await expect(sendEmailQueueProcessor({ emailId: 'nonexistent' })).rejects.toThrow(
      QueueRetryError
    );

    expect(sendEmailSingleQueue.addMany).not.toHaveBeenCalled();
  });

  it('should handle email with no destinations', async () => {
    const mockEmail = {
      id: 'email-456',
      oid: 2n,
      destinations: []
    };

    db.outgoingEmail.findFirst.mockResolvedValue(mockEmail);
    sendEmailSingleQueue.addMany.mockResolvedValue(undefined);

    await sendEmailQueueProcessor({ emailId: 'email-456' });

    expect(sendEmailSingleQueue.addMany).toHaveBeenCalledWith([]);
  });

  it('should handle email with single destination', async () => {
    const mockEmail = {
      id: 'email-789',
      oid: 3n,
      destinations: [{ id: 10n, destination: 'single@example.com', status: 'pending' }]
    };

    db.outgoingEmail.findFirst.mockResolvedValue(mockEmail);
    sendEmailSingleQueue.addMany.mockResolvedValue(undefined);

    await sendEmailQueueProcessor({ emailId: 'email-789' });

    expect(sendEmailSingleQueue.addMany).toHaveBeenCalledWith([{ destinationId: 10n }]);
  });

  it('should propagate database errors', async () => {
    const dbError = new Error('Database connection failed');
    db.outgoingEmail.findFirst.mockRejectedValue(dbError);

    await expect(sendEmailQueueProcessor({ emailId: 'email-123' })).rejects.toThrow(
      'Database connection failed'
    );
  });

  it('should handle large number of destinations', async () => {
    const destinations = Array.from({ length: 1000 }, (_, i) => ({
      id: BigInt(i),
      destination: `user${i}@example.com`,
      status: 'pending'
    }));

    const mockEmail = {
      id: 'email-bulk',
      oid: 100n,
      destinations
    };

    db.outgoingEmail.findFirst.mockResolvedValue(mockEmail);
    sendEmailSingleQueue.addMany.mockResolvedValue(undefined);

    await sendEmailQueueProcessor({ emailId: 'email-bulk' });

    expect(sendEmailSingleQueue.addMany).toHaveBeenCalledWith(
      destinations.map((d) => ({ destinationId: d.id }))
    );
    expect(sendEmailSingleQueue.addMany.mock.calls[0][0]).toHaveLength(1000);
  });
});
