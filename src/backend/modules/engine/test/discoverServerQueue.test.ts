import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ServerSession, ServerDeployment } from '@metorial/db';

// Mock the dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverSession: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config) => ({
    process: vi.fn((processor) => {
      // Store the processor for testing
      (global as any).__testQueueProcessor = processor;
      return { processorFn: processor };
    }),
    add: vi.fn()
  }))
}));

vi.mock('../src/run/discover', () => ({
  discoverServer: vi.fn()
}));

// Import after mocks are set up
const { db } = await import('@metorial/db');
const { discoverServer } = await import('../src/run/discover');

// Manually import and execute the module to set up the processor
await import('../src/queues/discoverServer');

// Get the stored processor from the global scope
const queueProcessor = (global as any).__testQueueProcessor;

describe('discoverServerDeploymentQueue processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process job with server session', async () => {
    const mockData = {
      serverDeploymentId: 'deployment-id',
      serverSessionId: 'session-id'
    };

    const mockServerSession = {
      oid: 'session-oid',
      id: 'session-id',
      serverDeployment: {
        oid: 'deployment-oid',
        id: 'deployment-id'
      }
    };

    vi.mocked(db.serverSession.findFirst).mockResolvedValue(mockServerSession as any);
    vi.mocked(discoverServer).mockResolvedValue({ oid: 'deployment-oid' } as any);

    await queueProcessor(mockData);

    expect(db.serverSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'session-id' },
      include: { serverDeployment: true }
    });

    expect(discoverServer).toHaveBeenCalledWith('deployment-id', mockServerSession);
  });

  it('should process job without server session', async () => {
    const mockData = {
      serverDeploymentId: 'deployment-id'
    };

    vi.mocked(discoverServer).mockResolvedValue({ oid: 'deployment-oid' } as any);

    await queueProcessor(mockData);

    expect(db.serverSession.findFirst).not.toHaveBeenCalled();
    expect(discoverServer).toHaveBeenCalledWith('deployment-id', null);
  });

  it('should handle null data', async () => {
    await queueProcessor(null);

    expect(db.serverSession.findFirst).not.toHaveBeenCalled();
    expect(discoverServer).not.toHaveBeenCalled();
  });

  it('should handle undefined data', async () => {
    await queueProcessor(undefined);

    expect(db.serverSession.findFirst).not.toHaveBeenCalled();
    expect(discoverServer).not.toHaveBeenCalled();
  });

  it('should call discoverServer with null session if session not found', async () => {
    const mockData = {
      serverDeploymentId: 'deployment-id',
      serverSessionId: 'nonexistent-session-id'
    };

    vi.mocked(db.serverSession.findFirst).mockResolvedValue(null);
    vi.mocked(discoverServer).mockResolvedValue({ oid: 'deployment-oid' } as any);

    await queueProcessor(mockData);

    expect(db.serverSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'nonexistent-session-id' },
      include: { serverDeployment: true }
    });

    expect(discoverServer).toHaveBeenCalledWith('deployment-id', null);
  });

  it('should propagate errors from discoverServer', async () => {
    const mockData = {
      serverDeploymentId: 'deployment-id'
    };

    const error = new Error('Discovery failed');
    vi.mocked(discoverServer).mockRejectedValue(error);

    await expect(queueProcessor(mockData)).rejects.toThrow('Discovery failed');
  });

  it('should handle database errors when fetching session', async () => {
    const mockData = {
      serverDeploymentId: 'deployment-id',
      serverSessionId: 'session-id'
    };

    const error = new Error('Database error');
    vi.mocked(db.serverSession.findFirst).mockRejectedValue(error);

    await expect(queueProcessor(mockData)).rejects.toThrow('Database error');
  });
});

// Note: addServerDeploymentDiscovery function tests are omitted as they are simple wrappers
// around the queue.add() function. The processor logic above is the more critical part to test.
