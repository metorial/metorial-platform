import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getFullServerSession } from '../src/run/utils';
import type { ServerSession } from '@metorial/db';

// Mock the dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverSession: {
      findFirst: vi.fn()
    }
  }
}));

const { db } = await import('@metorial/db');

describe('getFullServerSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch server session with all nested relations', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      id: 'session-id',
      sessionOid: 'parent-session-oid'
    } as ServerSession;

    const mockFullServerSession = {
      oid: 'session-oid',
      id: 'session-id',
      sessionOid: 'parent-session-oid',
      serverDeployment: {
        oid: 'deployment-oid',
        id: 'deployment-id',
        config: {
          oid: 'config-oid',
          id: 'config-id'
        },
        serverVariant: {
          oid: 'variant-oid',
          id: 'variant-id',
          currentVersion: {
            oid: 'version-oid',
            id: 'version-id',
            lambda: {
              oid: 'lambda-oid',
              id: 'lambda-id'
            }
          }
        },
        serverImplementation: {
          oid: 'implementation-oid',
          id: 'implementation-id'
        }
      }
    };

    vi.mocked(db.serverSession.findFirst).mockResolvedValue(mockFullServerSession as any);

    const result = await getFullServerSession(mockServerSession);

    // Verify findFirst was called with correct parameters
    expect(db.serverSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'session-id' },
      include: {
        serverDeployment: {
          include: {
            config: true,
            serverVariant: {
              include: {
                currentVersion: {
                  include: {
                    lambda: true
                  }
                }
              }
            },
            serverImplementation: true
          }
        }
      }
    });

    expect(result).toEqual(mockFullServerSession);
  });

  it('should return null if server session is not found', async () => {
    const mockServerSession: ServerSession = {
      oid: 'nonexistent-oid',
      id: 'nonexistent-id',
      sessionOid: 'parent-session-oid'
    } as ServerSession;

    vi.mocked(db.serverSession.findFirst).mockResolvedValue(null);

    const result = await getFullServerSession(mockServerSession);

    expect(result).toBeNull();
  });

  it('should handle server session with null currentVersion', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      id: 'session-id',
      sessionOid: 'parent-session-oid'
    } as ServerSession;

    const mockFullServerSession = {
      oid: 'session-oid',
      id: 'session-id',
      sessionOid: 'parent-session-oid',
      serverDeployment: {
        oid: 'deployment-oid',
        id: 'deployment-id',
        config: {
          oid: 'config-oid',
          id: 'config-id'
        },
        serverVariant: {
          oid: 'variant-oid',
          id: 'variant-id',
          currentVersion: null
        },
        serverImplementation: {
          oid: 'implementation-oid',
          id: 'implementation-id'
        }
      }
    };

    vi.mocked(db.serverSession.findFirst).mockResolvedValue(mockFullServerSession as any);

    const result = await getFullServerSession(mockServerSession);

    expect(result).toEqual(mockFullServerSession);
    expect(result?.serverDeployment.serverVariant.currentVersion).toBeNull();
  });

  it('should handle server session with version but null lambda', async () => {
    const mockServerSession: ServerSession = {
      oid: 'session-oid',
      id: 'session-id',
      sessionOid: 'parent-session-oid'
    } as ServerSession;

    const mockFullServerSession = {
      oid: 'session-oid',
      id: 'session-id',
      sessionOid: 'parent-session-oid',
      serverDeployment: {
        oid: 'deployment-oid',
        id: 'deployment-id',
        config: {
          oid: 'config-oid',
          id: 'config-id'
        },
        serverVariant: {
          oid: 'variant-oid',
          id: 'variant-id',
          currentVersion: {
            oid: 'version-oid',
            id: 'version-id',
            lambda: null
          }
        },
        serverImplementation: {
          oid: 'implementation-oid',
          id: 'implementation-id'
        }
      }
    };

    vi.mocked(db.serverSession.findFirst).mockResolvedValue(mockFullServerSession as any);

    const result = await getFullServerSession(mockServerSession);

    expect(result).toEqual(mockFullServerSession);
    expect(result?.serverDeployment.serverVariant.currentVersion?.lambda).toBeNull();
  });

  it('should query by server session id', async () => {
    const mockServerSession: ServerSession = {
      oid: 'different-oid',
      id: 'query-by-this-id',
      sessionOid: 'parent-session-oid'
    } as ServerSession;

    vi.mocked(db.serverSession.findFirst).mockResolvedValue(null);

    await getFullServerSession(mockServerSession);

    // Verify that the query uses the id field, not the oid
    const callArg = vi.mocked(db.serverSession.findFirst).mock.calls[0][0];
    expect(callArg.where.id).toBe('query-by-this-id');
  });
});
