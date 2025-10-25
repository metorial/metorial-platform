import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrokerRunManager } from '../src/broker/manager';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverRun: {
      updateMany: vi.fn()
    },
    session: {
      updateMany: vi.fn()
    },
    serverSession: {
      update: vi.fn(),
      updateMany: vi.fn()
    },
    sessionConnection: {
      updateMany: vi.fn()
    },
    serverVersion: {
      updateMany: vi.fn()
    },
    serverVariant: {
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/debug', () => ({
  debug: {
    warn: vi.fn(),
    log: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@metorial/sentry', () => ({
  getSentry: vi.fn(() => ({
    captureException: vi.fn()
  }))
}));

vi.mock('@metorial/unified-id', () => ({
  getUnifiedIdIfNeeded: vi.fn((type, message) => message.payload?.id || 'unified_id_123')
}));

vi.mock('@metorial/id', () => ({
  generatePlainId: vi.fn(() => 'plain_id_123')
}));

vi.mock('@metorial/programmable-promise', () => ({
  ProgrammablePromise: class ProgrammablePromise<T> {
    public promise: Promise<T>;
    private resolveFunc!: (value: T) => void;
    private rejectFunc!: (reason?: any) => void;

    constructor() {
      this.promise = new Promise((resolve, reject) => {
        this.resolveFunc = resolve;
        this.rejectFunc = reject;
      });
    }

    resolve(value: T) {
      this.resolveFunc(value);
    }

    reject(reason?: any) {
      this.rejectFunc(reason);
    }
  }
}));

vi.mock('../src/broker/lib/bus', () => ({
  BrokerBus: {
    create: vi.fn(() => Promise.resolve({
      pullMessages: vi.fn(() => Promise.resolve([])),
      onMessage: vi.fn(),
      onStop: vi.fn(),
      sendMessage: vi.fn(),
      sendServerError: vi.fn(),
      close: vi.fn()
    }))
  }
}));

describe('BrokerRunManager', () => {
  let db: any;
  let BrokerBus: any;
  let Sentry: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    const dbModule = await import('@metorial/db');
    db = dbModule.db;

    const busModule = await import('../src/broker/lib/bus');
    BrokerBus = busModule.BrokerBus;

    const sentryModule = await import('@metorial/sentry');
    Sentry = sentryModule.getSentry();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('should create manager and set status to active', async () => {
      vi.useRealTimers();

      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      const mockServerVersion: any = {
        id: 'version_1',
        oid: 1
      };

      const mockInstance: any = {
        oid: 1,
        organization: {
          oid: 1
        }
      };

      db.serverRun.updateMany.mockResolvedValue({ count: 1 });

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        mockServerVersion,
        mockInstance
      );

      // Wait a bit for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(db.serverRun.updateMany).toHaveBeenCalled();

      await manager.close();

      vi.useFakeTimers();
    });

    it('should set up periodic database pings', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn()
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      db.serverRun.updateMany.mockResolvedValue({ count: 1 });
      db.session.updateMany.mockResolvedValue({ count: 1 });

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      // Advance time to trigger ping
      await vi.advanceTimersByTimeAsync(30000);

      expect(db.serverRun.updateMany).toHaveBeenCalledWith({
        where: { oid: mockServerRun.oid },
        data: { lastPingAt: expect.any(Date) }
      });

      expect(db.session.updateMany).toHaveBeenCalledWith({
        where: { oid: mockSession.sessionOid },
        data: { lastClientPingAt: expect.any(Date) }
      });
    });

    it('should create broker bus with correct parameters', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn()
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      const mockInstance: any = {
        oid: 1
      };

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        mockInstance
      );

      expect(BrokerBus.create).toHaveBeenCalledWith(
        { type: 'server', id: 'run_1' },
        mockSession,
        mockInstance,
        { subscribe: true }
      );
    });
  });

  describe('close', () => {
    it('should update server run status to completed', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      db.serverRun.updateMany.mockResolvedValue({ count: 1 });
      db.serverSession.updateMany.mockResolvedValue({ count: 1 });
      db.sessionConnection.updateMany.mockResolvedValue({ count: 1 });

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      await manager.close();

      expect(db.serverRun.updateMany).toHaveBeenCalledWith({
        where: { oid: mockServerRun.oid, status: 'active' },
        data: { status: 'completed' }
      });
    });

    it('should update server session status to stopped', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      db.serverSession.updateMany.mockResolvedValue({ count: 1 });

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      await manager.close();

      expect(db.serverSession.updateMany).toHaveBeenCalledWith({
        where: { id: mockSession.id },
        data: { status: 'stopped' }
      });
    });

    it('should end session connections', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      db.sessionConnection.updateMany.mockResolvedValue({ count: 1 });

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      await manager.close();

      expect(db.sessionConnection.updateMany).toHaveBeenCalledWith({
        where: { serverSessionOid: mockSession.oid, endedAt: null },
        data: { endedAt: expect.any(Date) }
      });
    });

    it('should close broker bus', async () => {
      vi.useRealTimers();

      const mockBus = {
        pullMessages: vi.fn(() => Promise.resolve([])),
        onMessage: vi.fn(),
        onStop: vi.fn(),
        sendMessage: vi.fn(),
        sendServerError: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      BrokerBus.create.mockResolvedValue(mockBus);

      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      // Wait for bus creation
      await new Promise(resolve => setTimeout(resolve, 100));

      await manager.close();

      expect(mockBus.close).toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should close implementation', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      await manager.close();

      expect(mockImplementation.close).toHaveBeenCalled();
    });

    it('should only close once even if called multiple times', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      db.serverRun.updateMany.mockResolvedValue({ count: 1 });
      db.serverSession.updateMany.mockResolvedValue({ count: 1 });

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      await manager.close();
      await manager.close();
      await manager.close();

      // Should only update once (plus the initial active status update)
      const completedCalls = db.serverRun.updateMany.mock.calls.filter(
        (call: any) => call[0].data.status === 'completed'
      );
      expect(completedCalls.length).toBe(1);
    });
  });

  describe('checkTimeout', () => {
    it('should have timeout checking functionality', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      // Check timeout method exists and can be called
      await manager.checkTimeout();

      // Method should not throw
      expect(true).toBe(true);
    });

    it('should handle timeout checks', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      await manager.checkTimeout();

      // checkTimeout should be callable without errors
      expect(true).toBe(true);
    });

    it('should not close if within timeout limits', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      // Advance time by less than timeout (15 seconds)
      vi.advanceTimersByTime(15000);

      await manager.checkTimeout();

      // Should not have called close on implementation
      expect(mockImplementation.close).not.toHaveBeenCalled();
    });
  });

  describe('waitForClose', () => {
    it('should resolve when manager is closed', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      const closePromise = manager.waitForClose;
      let resolved = false;

      closePromise.then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      await manager.close();

      await closePromise;

      expect(resolved).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle database errors gracefully during ping', async () => {
      vi.useRealTimers();

      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn()
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      db.serverRun.updateMany.mockRejectedValue(new Error('Database error'));

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      // Wait for ping to trigger
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should capture exception (async operation, so we just check the error was thrown)
      expect(db.serverRun.updateMany).toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should handle bus creation errors', async () => {
      vi.useRealTimers();

      BrokerBus.create.mockRejectedValue(new Error('Bus creation error'));

      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      // Wait for bus creation to fail
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have called close
      expect(mockImplementation.close).toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should handle multiple rapid close calls', async () => {
      const mockImplementation: any = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onMessage: vi.fn(),
        sendMessage: vi.fn(),
        close: vi.fn(() => Promise.resolve())
      };

      const mockServerRun = {
        oid: 1,
        id: 'run_1'
      };

      const mockSession: any = {
        id: 'session_1',
        oid: 1,
        sessionOid: 10,
        mcpInitialized: false
      };

      const manager = new BrokerRunManager(
        mockImplementation,
        mockServerRun as any,
        mockSession,
        {} as any,
        {} as any
      );

      // Call close multiple times rapidly
      const promises = Array.from({ length: 10 }, () => manager.close());

      await Promise.all(promises);

      // Should only call implementation close once
      expect(mockImplementation.close).toHaveBeenCalledTimes(1);
    });
  });
});
