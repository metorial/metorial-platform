import { beforeEach, describe, expect, it, vi } from 'vitest';

let magicMcpEndpointServerCount = vi.hoisted(() => vi.fn());
let listServerProviders = vi.hoisted(() => vi.fn());

vi.mock('@metorial/db', () => ({
  db: {
    magicMcpEndpointServer: {
      count: magicMcpEndpointServerCount,
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-subspace', () => ({
  subspaceMagicMcpBackingService: {
    listServerProviders
  }
}));

import {
  assertMagicMcpServerBackingProvidersActive,
  assertMagicMcpTargetLinkedResourcesActive
} from '../src/lib/magicMcpConnectHealth';

describe('magicMcpConnectHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects inactive servers on endpoints', async () => {
    magicMcpEndpointServerCount.mockResolvedValue(1);

    await expect(
      assertMagicMcpTargetLinkedResourcesActive({
        type: 'endpoint',
        target: {
          oid: 1n,
          status: 'active',
          instance: { id: 'ins_1' }
        } as any
      })
    ).rejects.toThrow('no longer active');
  });

  it('rejects servers without active subspace providers', async () => {
    listServerProviders.mockResolvedValue({
      items: []
    });

    await expect(
      assertMagicMcpServerBackingProvidersActive({
        instance: { id: 'ins_1' } as any,
        magicMcpServerBackingId: 'server_1'
      })
    ).rejects.toThrow('magic_mcp_backing_providers_unavailable');
  });
});
