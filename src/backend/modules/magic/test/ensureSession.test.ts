import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/backing', () => ({
  ensureMagicMcpServerBacking: vi.fn(),
  ensureMagicMcpEndpointBacking: vi.fn(),
  waitForMagicMcpServerBackingReady: vi.fn().mockResolvedValue(null),
  waitForMagicMcpEndpointBackingReady: vi.fn().mockResolvedValue(null)
}));

vi.mock('../src/lib/magicMcpConnectHealth', () => ({
  assertMagicMcpTargetLinkedResourcesActive: vi.fn(),
  assertMagicMcpTargetReadyForConnect: vi.fn()
}));

vi.mock('@metorial/db', () => {
  let db = {
    magicMcpSession: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  };

  return {
    db,
    ID: {
      generateId: vi.fn(async prefix => `${prefix}-id`)
    },
    Prisma: {
      PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
        code: string;

        constructor(message: string, code: string) {
          super(message);
          this.code = code;
        }
      }
    }
  };
});

import {
  ensureMagicMcpEndpointBacking,
  ensureMagicMcpServerBacking
} from '../src/lib/backing';
import {
  assertMagicMcpTargetLinkedResourcesActive,
  assertMagicMcpTargetReadyForConnect
} from '../src/lib/magicMcpConnectHealth';
import { db } from '@metorial/db';
import {
  ensureMagicMcpSubspaceSession,
  syncMagicMcpSubspaceSession
} from '../src/lib/ensureSession';

describe('ensureMagicMcpSubspaceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconciles a server before returning its backing session id', async () => {
    vi.mocked(ensureMagicMcpServerBacking).mockResolvedValue({
      hasSubspaceBacking: true,
      subspaceEphemeralManagedSessionId: 'ems_1'
    } as any);

    let target = {
      id: 'server-1',
      hasSubspaceBacking: false,
      subspaceEphemeralManagedSessionId: null,
      instance: { id: 'ins_1' }
    } as any;
    let result = await ensureMagicMcpSubspaceSession({ type: 'server', target });

    expect(ensureMagicMcpServerBacking).toHaveBeenCalledWith({
      instance: target.instance,
      server: target,
      isReconciliation: true,
      deferReconcile: false
    });
    expect(assertMagicMcpTargetReadyForConnect).toHaveBeenCalled();
    expect(result).toBe('ems_1');
  });

  it('uses an existing server backing session without reconciling', async () => {
    let target = {
      id: 'server-1',
      hasSubspaceBacking: true,
      subspaceEphemeralManagedSessionId: 'ems_existing',
      instance: { id: 'ins_1' }
    } as any;

    let result = await ensureMagicMcpSubspaceSession({ type: 'server', target });

    expect(ensureMagicMcpServerBacking).not.toHaveBeenCalled();
    expect(assertMagicMcpTargetLinkedResourcesActive).toHaveBeenCalled();
    expect(assertMagicMcpTargetReadyForConnect).not.toHaveBeenCalled();
    expect(result).toBe('ems_existing');
  });

  it('reconciles an endpoint before returning its backing session id', async () => {
    vi.mocked(ensureMagicMcpEndpointBacking).mockResolvedValue({
      hasSubspaceBacking: true,
      subspaceEphemeralManagedSessionId: 'ems_endpoint'
    } as any);

    let target = {
      id: 'endpoint-1',
      hasSubspaceBacking: false,
      subspaceEphemeralManagedSessionId: null,
      instance: { id: 'ins_1' }
    } as any;
    let result = await ensureMagicMcpSubspaceSession({ type: 'endpoint', target });

    expect(ensureMagicMcpEndpointBacking).toHaveBeenCalledWith({
      instance: target.instance,
      endpoint: target,
      isReconciliation: true,
      deferReconcile: false
    });
    expect(assertMagicMcpTargetReadyForConnect).toHaveBeenCalled();
    expect(result).toBe('ems_endpoint');
  });

  it('does not write when the loaded magic MCP session mapping is current', async () => {
    let subspaceSession = {
      oid: 1n,
      id: 'mms_1',
      instanceOid: 10n,
      subspaceSessionId: 'sess_1',
      subspaceSessionTemplateId: 'template_1',
      isActive: true,
      expiresAt: null,
      isConsumerReconciled: true
    } as any;

    let result = await syncMagicMcpSubspaceSession(
      {
        type: 'server',
        target: {
          oid: 20n,
          instance: { oid: 10n },
          subspaceSession
        }
      } as any,
      'sess_1',
      'template_1'
    );

    expect(result).toBe(subspaceSession);
    expect(db.magicMcpSession.findUnique).not.toHaveBeenCalled();
    expect(db.magicMcpSession.create).not.toHaveBeenCalled();
    expect(db.magicMcpSession.update).not.toHaveBeenCalled();
  });

  it('clears reconciliation only when the session mapping changes', async () => {
    (db.magicMcpSession.update as any).mockResolvedValue({
      oid: 1n,
      subspaceSessionId: 'sess_2',
      subspaceSessionTemplateId: 'template_1',
      isConsumerReconciled: false
    });

    await syncMagicMcpSubspaceSession(
      {
        type: 'endpoint',
        target: {
          oid: 20n,
          instance: { oid: 10n },
          subspaceSession: [
            {
              oid: 1n,
              subspaceSessionId: 'sess_1',
              subspaceSessionTemplateId: 'template_1',
              isActive: true,
              expiresAt: null,
              isConsumerReconciled: true
            }
          ]
        }
      } as any,
      'sess_2',
      'template_1'
    );

    expect(db.magicMcpSession.update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: expect.objectContaining({
        subspaceSessionId: 'sess_2',
        subspaceSessionTemplateId: 'template_1',
        isConsumerReconciled: false
      })
    });
  });
});
