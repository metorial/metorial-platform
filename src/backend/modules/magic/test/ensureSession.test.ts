import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/backing', () => ({
  ensureMagicMcpServerBacking: vi.fn(),
  ensureMagicMcpEndpointBacking: vi.fn()
}));

import {
  ensureMagicMcpEndpointBacking,
  ensureMagicMcpServerBacking
} from '../src/lib/backing';
import { ensureMagicMcpSubspaceSession } from '../src/lib/ensureSession';

describe('ensureMagicMcpSubspaceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses an existing server backing ephemeral managed session id', async () => {
    let result = await ensureMagicMcpSubspaceSession({
      type: 'server',
      target: {
        id: 'server-1',
        hasSubspaceBacking: true,
        subspaceEphemeralManagedSessionId: 'ems_1',
        instance: { id: 'ins_1' }
      } as any
    });

    expect(result).toBe('ems_1');
    expect(ensureMagicMcpServerBacking).not.toHaveBeenCalled();
  });

  it('reconciles a server before returning its backing session id', async () => {
    vi.mocked(ensureMagicMcpServerBacking).mockResolvedValue({
      hasSubspaceBacking: true,
      subspaceEphemeralManagedSessionId: 'ems_2'
    } as any);

    let target = {
      id: 'server-2',
      hasSubspaceBacking: false,
      subspaceEphemeralManagedSessionId: null,
      instance: { id: 'ins_1' }
    } as any;
    let result = await ensureMagicMcpSubspaceSession({ type: 'server', target });

    expect(ensureMagicMcpServerBacking).toHaveBeenCalledWith({
      instance: target.instance,
      server: target,
      isReconciliation: true
    });
    expect(result).toBe('ems_2');
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
      isReconciliation: true
    });
    expect(result).toBe('ems_endpoint');
  });
});
