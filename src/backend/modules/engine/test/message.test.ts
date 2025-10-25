import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createSessionMessage } from '../src/run/data/message';
import type { ServerSession, Instance, Organization } from '@metorial/db';
import type { EngineMcpMessage } from '../src/run/mcp/message';

// Mock the dependencies
vi.mock('@metorial/db', () => ({
  db: {
    sessionMessage: {
      create: vi.fn()
    },
    serverSession: {
      update: vi.fn()
    },
    session: {
      updateMany: vi.fn()
    }
  },
  ID: {
    normalizeUUID: vi.fn()
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@metorial/unified-id', () => ({
  getOriginalIdIfNeeded: vi.fn()
}));

vi.mock('@metorial/sentry', () => ({
  getSentry: vi.fn(() => ({
    captureException: vi.fn()
  }))
}));

const { db, ID } = await import('@metorial/db');
const { Fabric } = await import('@metorial/fabric');
const { getOriginalIdIfNeeded } = await import('@metorial/unified-id');

describe('createSessionMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a session message for server sender', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      sessionOid: 'parent-session-oid',
      id: 'session-id'
    } as ServerSession;

    const mockInstance: Instance & { organization: Organization } = {
      oid: 'instance-oid',
      organization: {
        oid: 'org-oid',
        id: 'org-id'
      } as Organization
    } as Instance & { organization: Organization };

    const mockMessage: EngineMcpMessage = {
      uuid: 'message-uuid',
      type: 'request',
      method: 'test/method',
      sender: { type: 'server', id: 'server-id' },
      originalId: '123',
      unifiedId: 'unified-123',
      message: { jsonrpc: '2.0', method: 'test/method', id: '123' } as any,
      senderType: 'server'
    };

    const mockCreatedMessage = {
      oid: 'created-message-oid',
      id: 'normalized-id'
    };

    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-id');
    vi.mocked(getOriginalIdIfNeeded).mockReturnValue('original-id');
    vi.mocked(db.sessionMessage.create).mockResolvedValue(mockCreatedMessage as any);
    vi.mocked(Fabric.fire).mockResolvedValue(undefined);
    vi.mocked(db.serverSession.update).mockResolvedValue({} as any);
    vi.mocked(db.session.updateMany).mockResolvedValue({} as any);

    const result = await createSessionMessage({
      message: mockMessage,
      serverSession: mockServerSession,
      instance: mockInstance
    });

    // Verify session message was created
    expect(db.sessionMessage.create).toHaveBeenCalledWith({
      data: {
        id: 'normalized-id',
        type: 'request',
        method: 'test/method',
        senderType: 'server',
        senderId: 'server-id',
        engineMessageId: 'message-uuid',
        serverSessionOid: 'session-oid',
        sessionOid: 'parent-session-oid',
        originalId: 'original-id',
        unifiedId: 'unified-123',
        payload: mockMessage.message
      }
    });

    // Verify before event was fired
    expect(Fabric.fire).toHaveBeenCalledWith('session.session_message.created:before', {
      organization: mockInstance.organization,
      instance: mockInstance,
      session: mockServerSession,
      participant: { type: 'server' }
    });

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify after event was fired
    expect(Fabric.fire).toHaveBeenCalledWith(
      'session.session_message.created.many:after',
      expect.objectContaining({
        organization: mockInstance.organization,
        instance: mockInstance,
        session: mockServerSession,
        sessionMessages: [mockCreatedMessage]
      })
    );

    // Verify server session was updated with server message counts
    expect(db.serverSession.update).toHaveBeenCalledWith({
      where: { oid: 'session-oid' },
      data: {
        totalProductiveServerMessageCount: { increment: 1 },
        lastServerActionAt: expect.any(Date)
      }
    });

    // Verify session was updated
    expect(db.session.updateMany).toHaveBeenCalledWith({
      where: { oid: 'parent-session-oid' },
      data: {
        totalProductiveServerMessageCount: { increment: 1 }
      }
    });

    expect(result).toBe(undefined);
  });

  it('should create a session message for client sender', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      sessionOid: 'parent-session-oid',
      id: 'session-id'
    } as ServerSession;

    const mockInstance: Instance & { organization: Organization } = {
      oid: 'instance-oid',
      organization: {
        oid: 'org-oid',
        id: 'org-id'
      } as Organization
    } as Instance & { organization: Organization };

    const mockMessage: EngineMcpMessage = {
      uuid: 'message-uuid',
      type: 'response',
      method: undefined,
      sender: { type: 'client', id: 'client-id' },
      originalId: undefined,
      unifiedId: undefined,
      message: { jsonrpc: '2.0', result: {}, id: '456' } as any,
      senderType: 'client'
    };

    const mockCreatedMessage = {
      oid: 'created-message-oid',
      id: 'normalized-id'
    };

    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-id');
    vi.mocked(getOriginalIdIfNeeded).mockReturnValue(undefined);
    vi.mocked(db.sessionMessage.create).mockResolvedValue(mockCreatedMessage as any);
    vi.mocked(Fabric.fire).mockResolvedValue(undefined);
    vi.mocked(db.serverSession.update).mockResolvedValue({} as any);
    vi.mocked(db.session.updateMany).mockResolvedValue({} as any);

    await createSessionMessage({
      message: mockMessage,
      serverSession: mockServerSession,
      instance: mockInstance
    });

    // Verify session message was created
    expect(db.sessionMessage.create).toHaveBeenCalledWith({
      data: {
        id: 'normalized-id',
        type: 'response',
        method: undefined,
        senderType: 'client',
        senderId: 'client-id',
        engineMessageId: 'message-uuid',
        serverSessionOid: 'session-oid',
        sessionOid: 'parent-session-oid',
        originalId: undefined,
        unifiedId: undefined,
        payload: mockMessage.message
      }
    });

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify server session was updated with client message counts
    expect(db.serverSession.update).toHaveBeenCalledWith({
      where: { oid: 'session-oid' },
      data: {
        totalProductiveClientMessageCount: { increment: 1 },
        lastClientActionAt: expect.any(Date)
      }
    });

    // Verify session was updated with client-specific fields
    expect(db.session.updateMany).toHaveBeenCalledWith({
      where: { oid: 'parent-session-oid' },
      data: {
        totalProductiveClientMessageCount: { increment: 1 },
        lastClientActionAt: expect.any(Date),
        lastClientPingAt: expect.any(Date),
        connectionStatus: 'connected'
      }
    });
  });

  it('should handle notification messages without method', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      sessionOid: 'parent-session-oid',
      id: 'session-id'
    } as ServerSession;

    const mockInstance: Instance & { organization: Organization } = {
      oid: 'instance-oid',
      organization: {
        oid: 'org-oid',
        id: 'org-id'
      } as Organization
    } as Instance & { organization: Organization };

    const mockMessage: EngineMcpMessage = {
      uuid: 'message-uuid',
      type: 'notification',
      method: 'notifications/message',
      sender: { type: 'server', id: 'server-id' },
      originalId: undefined,
      unifiedId: undefined,
      message: { jsonrpc: '2.0', method: 'notifications/message' } as any,
      senderType: 'server'
    };

    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-id');
    vi.mocked(getOriginalIdIfNeeded).mockReturnValue(undefined);
    vi.mocked(db.sessionMessage.create).mockResolvedValue({ oid: 'msg-oid' } as any);
    vi.mocked(Fabric.fire).mockResolvedValue(undefined);
    vi.mocked(db.serverSession.update).mockResolvedValue({} as any);
    vi.mocked(db.session.updateMany).mockResolvedValue({} as any);

    await createSessionMessage({
      message: mockMessage,
      serverSession: mockServerSession,
      instance: mockInstance
    });

    expect(db.sessionMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'notification',
        method: 'notifications/message'
      })
    });
  });

  it('should handle numeric originalId', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      sessionOid: 'parent-session-oid',
      id: 'session-id'
    } as ServerSession;

    const mockInstance: Instance & { organization: Organization } = {
      oid: 'instance-oid',
      organization: {
        oid: 'org-oid',
        id: 'org-id'
      } as Organization
    } as Instance & { organization: Organization };

    const mockMessage: EngineMcpMessage = {
      uuid: 'message-uuid',
      type: 'request',
      method: 'test/method',
      sender: { type: 'client', id: 'client-id' },
      originalId: 789,
      unifiedId: 'unified-789',
      message: { jsonrpc: '2.0', method: 'test/method', id: 789 } as any,
      senderType: 'client'
    };

    vi.mocked(ID.normalizeUUID).mockReturnValue('normalized-id');
    vi.mocked(getOriginalIdIfNeeded).mockReturnValue(789);
    vi.mocked(db.sessionMessage.create).mockResolvedValue({ oid: 'msg-oid' } as any);
    vi.mocked(Fabric.fire).mockResolvedValue(undefined);
    vi.mocked(db.serverSession.update).mockResolvedValue({} as any);
    vi.mocked(db.session.updateMany).mockResolvedValue({} as any);

    await createSessionMessage({
      message: mockMessage,
      serverSession: mockServerSession,
      instance: mockInstance
    });

    expect(db.sessionMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        originalId: 789,
        unifiedId: 'unified-789'
      })
    });
  });
});
