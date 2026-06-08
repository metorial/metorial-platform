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

vi.mock('@metorial/db', () => ({
  db: {},
  ID: {
    generateId: vi.fn()
  },
  withTransaction: vi.fn()
}));

import {
  ensureMagicMcpEndpointBacking,
  ensureMagicMcpServerBacking
} from '../src/lib/backing';
import {
  assertMagicMcpTargetLinkedResourcesActive,
  assertMagicMcpTargetReadyForConnect
} from '../src/lib/magicMcpConnectHealth';
import { ensureMagicMcpSubspaceSession } from '../src/lib/ensureSession';

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
});
